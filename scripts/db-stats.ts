/** Read-only database inventory. Run with --deep for payload/age scans.
 * No query text, connection strings, row contents or client addresses are emitted.
 * Each sample uses a new read-only transaction so cumulative stats do not stay cached.
 */
import 'dotenv/config';
import { Client } from 'pg';
import { databaseConnection } from '../lib/server/database-connection';

const client = new Client({
  ...databaseConnection(),
  application_name: 'ertad-db-stats',
  connectionTimeoutMillis: 10_000,
});
const deep = process.argv.includes('--deep');
const activitySql = `SELECT application_name,backend_type,state,wait_event_type,wait_event,
  count(*)::int connections,max(extract(epoch FROM now()-xact_start))::int oldest_xact_seconds
  FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid()
  GROUP BY 1,2,3,4,5 ORDER BY 6 DESC`;

async function sample(name: string, sql: string) {
  const started = performance.now();
  await client.query('BEGIN READ ONLY');
  try {
    await client.query("SET LOCAL statement_timeout='30s'");
    await client.query("SET LOCAL lock_timeout='2s'");
    const rows = (await client.query(sql)).rows;
    await client.query('COMMIT');
    console.log(
      JSON.stringify({
        name,
        at: new Date().toISOString(),
        elapsed_ms: Math.round(performance.now() - started),
        rows,
      }),
    );
    return rows;
  } catch (error) {
    await client.query('ROLLBACK');
    // Error messages can contain SQL or connection details. Report only the SQLSTATE.
    console.log(
      JSON.stringify({
        name,
        unavailable: true,
        code: (error as { code?: string }).code ?? 'unknown',
      }),
    );
    return [];
  }
}

await client.connect();
try {
  await sample(
    'database',
    `SELECT current_database() database, current_setting('server_version') version,
    pg_postmaster_start_time() started,pg_database_size(current_database()) bytes,
    stats_reset,numbackends,xact_commit,xact_rollback,blks_read,blks_hit,temp_files,temp_bytes,deadlocks
    FROM pg_stat_database WHERE datname=current_database()`,
  );
  const extensions = await sample(
    'extensions',
    'SELECT extname,extversion FROM pg_extension ORDER BY 1',
  );
  await sample('activity_start', activitySql);
  await sample(
    'settings',
    `SELECT name,setting,reset_val,unit,source FROM pg_settings WHERE name IN (
    'max_connections','shared_preload_libraries','track_counts','track_io_timing','stats_fetch_consistency',
    'autovacuum','autovacuum_max_workers','autovacuum_naptime','autovacuum_vacuum_threshold',
    'autovacuum_vacuum_scale_factor','autovacuum_vacuum_insert_threshold','autovacuum_vacuum_insert_scale_factor',
    'autovacuum_analyze_threshold','autovacuum_analyze_scale_factor','autovacuum_vacuum_cost_delay',
    'autovacuum_vacuum_cost_limit','autovacuum_freeze_max_age','idle_in_transaction_session_timeout',
    'statement_timeout') ORDER BY name`,
  );
  await sample(
    'tables',
    `SELECT s.relname,pg_total_relation_size(s.relid) total_bytes,
    pg_relation_size(s.relid) heap_bytes,pg_indexes_size(s.relid) index_bytes,
    CASE WHEN c.reltoastrelid=0 THEN 0 ELSE pg_total_relation_size(c.reltoastrelid) END toast_bytes,
    c.reloptions,age(c.relfrozenxid) xid_age,s.n_live_tup,s.n_dead_tup,s.n_tup_ins,s.n_tup_upd,s.n_tup_hot_upd,s.n_tup_del,
    round(100.0*s.n_tup_hot_upd/nullif(s.n_tup_upd,0),2) hot_percent,
    s.last_autovacuum,s.last_autoanalyze,s.last_vacuum,s.last_analyze
    FROM pg_stat_user_tables s JOIN pg_class c ON c.oid=s.relid ORDER BY total_bytes DESC`,
  );
  await sample(
    'indexes',
    `SELECT s.relname,s.indexrelname,pg_relation_size(s.indexrelid) bytes,
    s.idx_scan,s.idx_tup_read,s.idx_tup_fetch,i.indisprimary,i.indisunique,i.indisvalid,
    pg_get_indexdef(s.indexrelid) definition
    FROM pg_stat_user_indexes s JOIN pg_index i ON i.indexrelid=s.indexrelid ORDER BY bytes DESC`,
  );
  await sample(
    'duplicate_indexes',
    `SELECT a.indrelid::regclass::text table_name,
    a.indexrelid::regclass::text first_index,b.indexrelid::regclass::text second_index
    FROM pg_index a JOIN pg_index b ON a.indrelid=b.indrelid AND a.indexrelid<b.indexrelid
    JOIN pg_class ac ON ac.oid=a.indexrelid JOIN pg_class bc ON bc.oid=b.indexrelid
    JOIN pg_namespace n ON n.oid=ac.relnamespace
    WHERE n.nspname='public' AND ac.relam=bc.relam AND a.indkey=b.indkey AND a.indclass=b.indclass
    AND a.indcollation=b.indcollation AND a.indoption=b.indoption AND a.indnkeyatts=b.indnkeyatts
    AND a.indisunique=b.indisunique AND a.indnullsnotdistinct=b.indnullsnotdistinct
    AND a.indexprs::text IS NOT DISTINCT FROM b.indexprs::text
    AND a.indpred::text IS NOT DISTINCT FROM b.indpred::text`,
  );
  if (extensions.some((e) => e.extname === 'pg_stat_statements')) {
    await sample('statements_info', 'SELECT * FROM pg_stat_statements_info');
    for (const order of ['total_exec_time', 'calls', 'mean_exec_time'])
      await sample(
        `statements_by_${order}`,
        `SELECT queryid,calls,total_exec_time,mean_exec_time,rows,
        shared_blks_hit,shared_blks_read,temp_blks_written,wal_bytes FROM pg_stat_statements
        WHERE dbid=(SELECT oid FROM pg_database WHERE datname=current_database())
        ORDER BY ${order} DESC LIMIT 15`,
      );
  }
  await sample('activity_middle', activitySql);
  if (deep) {
    await sample(
      'payloads',
      `SELECT 'source_items.raw' field,count(*) rows,
      sum(pg_column_size(raw)) stored_value_bytes,sum(octet_length(raw::text)) json_text_bytes FROM source_items
      UNION ALL SELECT 'jobs.draft',count(*),sum(pg_column_size(draft)),sum(octet_length(draft::text)) FROM jobs
      UNION ALL SELECT 'jobs.published',count(published),sum(pg_column_size(published)),sum(octet_length(published::text)) FROM jobs
      UNION ALL SELECT 'jobs.equal_snapshots',count(*),NULL,NULL FROM jobs WHERE draft=published`,
    );
    await sample(
      'audit_actions',
      `SELECT action,count(*) rows,
      sum(coalesce(pg_column_size(before_data),0)+coalesce(pg_column_size(after_data),0)) stored_payload_bytes,
      sum(coalesce(octet_length(before_data::text),0)+coalesce(octet_length(after_data::text),0)) json_text_bytes,
      min(created_at) oldest,max(created_at) newest FROM audit_log GROUP BY 1 ORDER BY stored_payload_bytes DESC`,
    );
    await sample(
      'audit_ages',
      `SELECT action,CASE WHEN created_at>=now()-interval '7 days' THEN '0-7d'
      WHEN created_at>=now()-interval '30 days' THEN '7-30d' WHEN created_at>=now()-interval '90 days' THEN '30-90d'
      ELSE '90d+' END age_bucket,count(*) rows,
      sum(coalesce(pg_column_size(before_data),0)+coalesce(pg_column_size(after_data),0)) stored_payload_bytes
      FROM audit_log GROUP BY 1,2 ORDER BY 1,2`,
    );
    for (const [table, date] of [
      ['source_runs', 'started_at'],
      ['login_attempts', 'created_at'],
      ['analytics_events', 'created_at'],
      ['analytics_daily', 'day'],
    ])
      await sample(
        `${table}_age`,
        `SELECT count(*) rows,min(${date}) oldest,max(${date}) newest,
        count(*) FILTER (WHERE ${date}<now()-interval '30 days') over_30d,
        count(*) FILTER (WHERE ${date}<now()-interval '90 days') over_90d FROM ${table}`,
      );
    await sample(
      'source_items_quality',
      `SELECT count(*) rows,count(*) FILTER (WHERE quality_candidate IS NULL
      AND quality_signature IS NULL AND quality_warning IS NULL AND quality_first_seen IS NULL
      AND quality_last_seen IS NULL AND quality_observations=0) already_clear,
      count(*) FILTER (WHERE job_id IS NULL) unlinked FROM source_items`,
    );
    await sample(
      'jobs_status',
      'SELECT status,count(*) rows FROM jobs GROUP BY status ORDER BY status',
    );
  }
  await sample('activity_end', activitySql);
} finally {
  await client.end();
}
