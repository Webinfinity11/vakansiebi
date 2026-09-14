import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { db } from '../lib/server/db';
import {
  configs,
  externalId,
  fingerprint,
  tbilisiDate,
} from '../worker/adapters';
import { publishable } from '../worker/automation';
import type { ActiveSourceId } from '../lib/types';

// Restore identity and discovery seeds only. A historical snapshot must be
// re-fetched and validated before it becomes publicly visible again.
const file = process.argv.find((arg) => arg.startsWith('--file='))?.slice(7);
if (!file) throw new Error('Required: --file=/path/to/backup.json');
const backup = JSON.parse(await readFile(file, 'utf8'));
if (
  backup.version !== 1 ||
  !Array.isArray(backup.jobs) ||
  !Array.isArray(backup.source_items)
)
  throw new Error('Unsupported backup format');
type BackupItem = {
  id: string;
  source_id: ActiveSourceId;
  external_id: string;
  url: string;
  job_id: string | null;
  discovered_at: string;
};
type BackupJob = {
  id: string;
  status: string;
  draft: unknown;
  published: unknown;
  created_at: string;
};
const items = (backup.source_items as BackupItem[]).filter((item) => {
  if (!Object.hasOwn(configs, item.source_id)) return false;
  try {
    return externalId(item.source_id, item.url) === item.external_id;
  } catch {
    return false;
  }
});
const jobs = (backup.jobs as BackupJob[]).flatMap((job) => {
  if (!['published', 'pending'].includes(job.status)) return [];
  const linked = items.filter((item) => item.job_id === job.id);
  const candidate = linked
    .map((item) =>
      publishable(
        job.published || job.draft,
        item.source_id,
        item.url,
        tbilisiDate(),
      ),
    )
    .find(Boolean);
  return candidate ? [{ job, candidate, linked }] : [];
});
console.log(
  JSON.stringify({
    backupCreatedAt: backup.createdAt,
    eligibleJobs: jobs.length,
    eligibleSourceItems: jobs.reduce((n, job) => n + job.linked.length, 0),
    excludedJobs: backup.jobs.length - jobs.length,
    publishedWithoutVerification: 0,
  }),
);
if (process.argv.includes('--apply')) {
  const client = await db().connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout='10s'");
    await client.query('LOCK TABLE jobs,source_items IN EXCLUSIVE MODE');
    const existing = await client.query(
      'SELECT (SELECT count(*) FROM jobs)+(SELECT count(*) FROM source_items) AS total',
    );
    if (Number(existing.rows[0].total) !== 0)
      throw new Error(
        'Restore requires an empty destination; existing records were not changed',
      );
    for (const { job, candidate, linked } of jobs) {
      await client.query(
        `INSERT INTO jobs(id,draft,published,status,needs_review,fingerprint,created_at,automation_managed,automation_reason)
        VALUES($1,$2,NULL,'pending',true,$3,$4,true,'awaiting_source')`,
        [job.id, candidate, fingerprint(candidate), job.created_at],
      );
      for (const item of linked)
        await client.query(
          `INSERT INTO source_items(id,source_id,external_id,url,job_id,discovered_at,next_check_at)
          VALUES($1,$2,$3,$4,$5,$6,now())`,
          [
            item.id,
            item.source_id,
            item.external_id,
            item.url,
            job.id,
            item.discovered_at,
          ],
        );
    }
    await client.query('COMMIT');
    console.log(JSON.stringify({ restoredPending: jobs.length, published: 0 }));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await db().end();
  }
}
