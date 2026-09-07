import { createHash, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { db, transaction } from '../lib/server/db';
import { fingerprint } from './adapters';
import type { SourceId, Vacancy } from '../lib/types';
export function hashVacancy(v: Vacancy) {
  return createHash('sha256').update(JSON.stringify(v)).digest('hex');
}
export async function stageVacancy(itemId: string, v: Vacancy, hours = 6) {
  return transaction(async (c) => {
    const item = (
      await c.query('SELECT * FROM source_items WHERE id=$1 FOR UPDATE', [
        itemId,
      ])
    ).rows[0];
    if (!item) throw Error('Item missing');
    const hash = hashVacancy(v);
    let outcome = 'unchanged';
    let jobId = item.job_id;
    if (!jobId) {
      jobId = randomUUID();
      await c.query('INSERT INTO jobs(id,draft,fingerprint) VALUES($1,$2,$3)', [
        jobId,
        v,
        fingerprint(v),
      ]);
      outcome = 'imported';
    } else if (item.content_hash !== hash) {
      await c.query(
        'UPDATE jobs SET needs_review=true,version=version+1,updated_at=now() WHERE id=$1',
        [jobId],
      );
      outcome = 'changed';
    }
    // Existing editorial draft and published snapshot are never overwritten by crawling.
    await c.query(
      "UPDATE source_items SET job_id=$2,raw=$3,content_hash=$4,last_checked_at=now(),next_check_at=now()+($5*interval '1 hour'),error=NULL,failures=0 WHERE id=$1",
      [itemId, jobId, v, hash, hours],
    );
    if (outcome !== 'unchanged')
      await audit(
        c,
        jobId,
        'source.' + outcome,
        'crawler:' + item.source_id,
        item.raw,
        v,
      );
    return outcome;
  });
}
export async function discoverItems(
  source: SourceId,
  links: { externalId: string; url: string }[],
) {
  for (let i = 0; i < links.length; i += 100) {
    const chunk = links.slice(i, i + 100);
    const values: unknown[] = [];
    const placeholders = chunk.map((a, k) => {
      values.push(randomUUID(), source, a.externalId, a.url);
      const n = k * 4;
      return `($${n + 1},$${n + 2},$${n + 3},$${n + 4})`;
    });
    if (chunk.length)
      await db().query(
        `INSERT INTO source_items(id,source_id,external_id,url) VALUES ${placeholders.join(',')} ON CONFLICT(source_id,external_id) DO UPDATE SET last_seen_at=now(),url=excluded.url`,
        values,
      );
  }
}
export async function audit(
  c: PoolClient,
  jobId: string,
  action: string,
  actor: string,
  before: unknown,
  after: unknown,
) {
  await c.query(
    'INSERT INTO audit_log(job_id,action,actor,before_data,after_data) VALUES($1,$2,$3,$4,$5)',
    [jobId, action, actor, before, after],
  );
}
