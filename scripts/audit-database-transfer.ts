/** Read-only payload audit. Computes byte counts inside PostgreSQL, returning only aggregates.
 * These are JSON payload estimates, not provider-billed TLS/protocol byte measurements. */
import 'dotenv/config';
import { db } from '../lib/server/db';
import { detailQueueProjection } from '../worker/detail-queue';
import { reconciliationJobProjection } from '../worker/automation';
import { employerRowsSql } from '../lib/server/employers';
const client = await db().connect();
try {
  await client.query('BEGIN READ ONLY');
  await client.query("SET LOCAL statement_timeout='30s'");
  for (const [name, query] of [
    [
      'reconciliation',
      `WITH sample AS MATERIALIZED (SELECT * FROM jobs WHERE status='published' ORDER BY id LIMIT 500),
      compact AS (SELECT ${reconciliationJobProjection} FROM sample)
      SELECT (SELECT count(*) FROM sample)::int records,
       (SELECT sum(octet_length(row_to_json(s)::text)) FROM sample s)::bigint before_bytes,
       (SELECT sum(octet_length(row_to_json(s)::text)) FROM compact s)::bigint after_bytes`,
    ],
    [
      'recheck_queue',
      `WITH sample AS MATERIALIZED (SELECT * FROM source_items WHERE raw IS NOT NULL ORDER BY id LIMIT 200),
      compact AS (SELECT ${detailQueueProjection} FROM sample)
      SELECT (SELECT count(*) FROM sample)::int records,
       (SELECT sum(octet_length(row_to_json(s)::text)) FROM sample s)::bigint before_bytes,
       (SELECT sum(octet_length(row_to_json(s)::text)) FROM compact s)::bigint after_bytes`,
    ],
    [
      'employer_directory',
      `WITH compact AS MATERIALIZED (${employerRowsSql}),
      expanded AS (SELECT unnest(ids) id,name,logo,city,sources FROM compact)
      SELECT (SELECT count(*) FROM expanded)::int records,(SELECT count(*) FROM compact)::int grouped_rows,
       (SELECT sum(octet_length(row_to_json(s)::text)) FROM expanded s)::bigint before_bytes,
       (SELECT sum(octet_length(row_to_json(s)::text)) FROM compact s)::bigint after_bytes`,
    ],
  ] as const) {
    const row = (await client.query(query)).rows[0];
    const before = Number(row.before_bytes),
      after = Number(row.after_bytes);
    console.log(
      JSON.stringify({
        name,
        ...row,
        reduction_percent: Math.round((1 - after / before) * 1000) / 10,
      }),
    );
  }
  await client.query('COMMIT');
} finally {
  client.release();
  await db().end();
}
