import 'dotenv/config';
import { mkdir, open } from 'node:fs/promises';
import { resolve } from 'node:path';
import { db } from '../lib/server/db';
import { sourceLockIds } from '../worker/adapters';

// Explicit operator command. A scheduled worker must never clear the catalogue.
if (!process.argv.includes('--confirm=reset-all-vacancies'))
  throw Error('Required: --confirm=reset-all-vacancies');
const c = await db().connect();
try {
  await c.query('BEGIN');
  await c.query("SET LOCAL lock_timeout='10s'");
  for (const id of Object.values(sourceLockIds)) {
    const result = await c.query(
      'SELECT pg_try_advisory_xact_lock($1) AS locked',
      [id],
    );
    if (!result.rows[0].locked)
      throw Error('A scraper is running; reset aborted without changes');
  }
  await c.query(
    'LOCK TABLE sources,source_items,jobs,audit_log,source_runs,company_profiles IN EXCLUSIVE MODE',
  );
  const backup: Record<string, unknown> = {
    version: 1,
    createdAt: new Date().toISOString(),
  };
  for (const table of [
    'sources',
    'jobs',
    'source_items',
    'audit_log',
    'source_runs',
    'company_profiles',
  ]) {
    backup[table] = (await c.query(`SELECT * FROM ${table}`)).rows;
  }
  const directory = resolve('.local/backups');
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const path = resolve(directory, `vacancies-before-reset-${Date.now()}.json`);
  const file = await open(path, 'wx', 0o600);
  try {
    await file.writeFile(JSON.stringify(backup));
    await file.sync();
  } finally {
    await file.close();
  }
  await c.query('DELETE FROM audit_log WHERE job_id IS NOT NULL');
  await c.query('DELETE FROM source_items');
  await c.query('DELETE FROM jobs');
  await c.query(`UPDATE sources SET sitemap_cursor=0,last_started_at=NULL,last_success_at=NULL,
    last_error=NULL,consecutive_failures=0,next_run_at=now(),requested_at=CASE WHEN enabled AND NOT retired THEN now() ELSE NULL END`);
  await c.query('COMMIT');
  console.log(
    JSON.stringify({
      backup: path,
      deletedJobs: (backup.jobs as unknown[]).length,
      deletedItems: (backup.source_items as unknown[]).length,
    }),
  );
} catch (error) {
  await c.query('ROLLBACK');
  throw error;
} finally {
  c.release();
  await db().end();
}
