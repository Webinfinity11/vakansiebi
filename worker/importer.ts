import { createHash, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { db, transaction } from '../lib/server/db';
import { fingerprint, tbilisiDate } from './adapters';
import { samePosting } from '../lib/job-intelligence';
import type { SourceId, Vacancy } from '../lib/types';
import { reconcileJob } from './automation';
import { assessVacancy } from './quality';
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
    const quality = assessVacancy(item.raw, v, {
      signature: item.quality_signature,
      firstSeen: item.quality_first_seen,
      lastSeen: item.quality_last_seen,
      observations: item.quality_observations || 0,
    });
    if (quality.hold) {
      await c.query(
        `UPDATE source_items SET quality_candidate=$2,quality_signature=$3,quality_warning=$4,
        quality_first_seen=$5,quality_last_seen=$6,quality_observations=$7,last_checked_at=now(),error=NULL,failures=0,
        next_check_at=now()+interval '30 minutes' WHERE id=$1`,
        [
          itemId,
          v,
          quality.signature,
          quality.warning,
          quality.firstSeen,
          quality.lastSeen,
          quality.observations,
        ],
      );
      if (item.job_id && item.quality_signature !== quality.signature) {
        await c.query(
          'UPDATE jobs SET needs_review=(NOT automation_managed OR automation_paused),version=version+1 WHERE id=$1',
          [item.job_id],
        );
        await audit(
          c,
          item.job_id,
          'source.quality_held',
          'crawler:' + item.source_id,
          { warning: item.quality_warning },
          { warning: quality.warning },
        );
      }
      return 'quality_held';
    }
    await c.query(
      `UPDATE source_items SET quality_candidate=NULL,quality_signature=NULL,quality_warning=NULL,
      quality_first_seen=NULL,quality_last_seen=NULL,quality_observations=0 WHERE id=$1`,
      [itemId],
    );
    // A catalogue refresh explicitly requests current source text, including older paused snapshots.
    // A newer editor change wins over the queued refresh request.
    if (
      item.job_id &&
      item.refresh_requested_at &&
      (!item.refresh_completed_at ||
        item.refresh_requested_at > item.refresh_completed_at)
    ) {
      const resumed = await c.query(
        `UPDATE jobs SET automation_managed=true,automation_paused=false WHERE id=$1
        AND status='published' AND published->>'url'=$2 AND updated_at<=$3
        AND (NOT automation_managed OR automation_paused) RETURNING id`,
        [item.job_id, item.url, item.refresh_requested_at],
      );
      if (resumed.rowCount)
        await audit(
          c,
          item.job_id,
          'automation.resumed',
          'requested:full-description-refresh',
          { refreshRequestedAt: item.refresh_requested_at },
          { automation_managed: true, automation_paused: false },
        );
    }
    const hash = hashVacancy(v);
    if (!item.job_id && v.deadline && v.deadline < tbilisiDate()) {
      await c.query(
        "UPDATE source_items SET raw=$2,content_hash=$3,last_checked_at=now(),next_check_at=now()+interval '7 days',error=NULL,failures=0 WHERE id=$1",
        [itemId, v, hash],
      );
      return 'expired';
    }
    let outcome = 'unchanged';
    let jobId = item.job_id;
    if (!jobId) {
      // Serializes identical imports arriving from independent source workers.
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        'posting:' + fingerprint(v),
      ]);
      const candidates = (
        await c.query(
          `SELECT j.id,j.draft FROM jobs j WHERE j.fingerprint=$1
        AND (j.status='pending' OR (j.status='published' AND j.automation_managed AND NOT j.automation_paused)) AND EXISTS (SELECT 1 FROM source_items other
          JOIN sources s ON s.id=other.source_id WHERE other.job_id=j.id AND NOT s.retired AND other.source_id<>$2)
        AND NOT EXISTS (SELECT 1 FROM source_items same WHERE same.job_id=j.id AND same.source_id=$2)
        ORDER BY j.created_at,j.id FOR UPDATE`,
          [fingerprint(v), item.source_id],
        )
      ).rows;
      const matches = candidates.filter((candidate) =>
        samePosting(candidate.draft, v),
      );
      if (matches.length === 1) {
        jobId = matches[0].id;
        outcome = 'linked';
        await c.query(
          'UPDATE jobs SET version=version+1,needs_review=true,updated_at=now() WHERE id=$1',
          [jobId],
        );
      }
    }
    if (!jobId) {
      jobId = randomUUID();
      await c.query('INSERT INTO jobs(id,draft,fingerprint) VALUES($1,$2,$3)', [
        jobId,
        v,
        fingerprint(v),
      ]);
      outcome = 'imported';
    } else if (item.job_id && item.content_hash !== hash) {
      await c.query(
        'UPDATE jobs SET needs_review=true,version=version+1,updated_at=now() WHERE id=$1',
        [jobId],
      );
      outcome = 'changed';
    }
    // Existing editorial draft and published snapshot are never overwritten by crawling.
    await c.query(
      "UPDATE source_items SET job_id=$2,raw=$3,content_hash=$4,last_checked_at=now(),last_verified_at=now(),refresh_completed_at=CASE WHEN refresh_requested_at IS NOT NULL THEN now() ELSE refresh_completed_at END,next_check_at=now()+($5*interval '1 hour'),error=NULL,failures=0 WHERE id=$1",
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
    await reconcileJob(c, jobId);
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
