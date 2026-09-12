import { createHash, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { db, transaction } from '../lib/server/db';
import {
  applyListingHints,
  fingerprint,
  tbilisiDate,
  type ListingHints,
} from './adapters';
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
/** Listing hints accumulate: a later page without a category keeps the one already known. */
export async function discoverItems(
  source: SourceId,
  links: { externalId: string; url: string; hints?: ListingHints }[],
) {
  for (let i = 0; i < links.length; i += 100) {
    const chunk = links.slice(i, i + 100);
    const values: unknown[] = [];
    const placeholders = chunk.map((a, k) => {
      values.push(
        randomUUID(),
        source,
        a.externalId,
        a.url,
        a.hints && Object.keys(a.hints).length ? a.hints : null,
      );
      const n = k * 5;
      return `($${n + 1},$${n + 2},$${n + 3},$${n + 4},$${n + 5})`;
    });
    if (chunk.length)
      await db().query(
        `INSERT INTO source_items(id,source_id,external_id,url,listing_hints) VALUES ${placeholders.join(',')}
        ON CONFLICT(source_id,external_id) DO UPDATE SET last_seen_at=now(),url=excluded.url,
        listing_hints=CASE WHEN excluded.listing_hints IS NULL THEN source_items.listing_hints ELSE COALESCE(source_items.listing_hints,'{}'::jsonb)||excluded.listing_hints END`,
        values,
      );
    if (chunk.length)
      await applyStoredHints(
        source,
        chunk.map((a) => a.externalId),
      );
  }
}
/**
 * A hint that arrives after a vacancy was imported is applied to the stored copy right away.
 *
 * Until now it waited for the worker to parse that detail page again, and on jobs.ge, read
 * slowly under its crawl delay, 265 published vacancies went without the city and 179 without
 * the category their own listing named. The stored copy is updated through the same function
 * the detail parse uses, with its hash, so the next read of that page finds nothing changed;
 * the job is moved to the front of the reconcile queue so automation publishes the fuller copy
 * on its next pass. An editor's published text is untouched — only the source copy moves.
 */
async function applyStoredHints(source: SourceId, externalIds: string[]) {
  const items = (
    await db().query(
      `SELECT id, job_id, raw, listing_hints FROM source_items
       WHERE source_id=$1 AND external_id = ANY($2) AND job_id IS NOT NULL AND raw IS NOT NULL AND listing_hints IS NOT NULL`,
      [source, externalIds],
    )
  ).rows;
  for (const item of items) {
    const next = applyListingHints(source, item.raw, item.listing_hints);
    const hash = hashVacancy(next);
    if (hash === hashVacancy(item.raw)) continue;
    await transaction(async (c) => {
      await c.query(
        'UPDATE source_items SET raw=$2, content_hash=$3 WHERE id=$1',
        [item.id, next, hash],
      );
      await c.query('UPDATE jobs SET automation_checked_at=NULL WHERE id=$1', [
        item.job_id,
      ]);
      await audit(
        c,
        item.job_id,
        'source.hints_applied',
        'importer',
        { city: item.raw.city, category: item.raw.category },
        { city: next.city, category: next.category },
      );
    });
  }
}
const plainObject = (v: unknown): v is Record<string, unknown> =>
  Boolean(v) && typeof v === 'object' && !Array.isArray(v);
/** Long text is kept as a readable head plus its original length, at every depth. */
const shortened = (v: unknown): unknown => {
  if (typeof v === 'string')
    return v.length > 240 ? v.slice(0, 240) + `…(${v.length})` : v;
  if (Array.isArray(v)) return v.map(shortened);
  if (plainObject(v))
    return Object.fromEntries(
      Object.entries(v).map(([k, value]) => [k, shortened(value)]),
    );
  return v;
};
/**
 * The trail records what changed, not a second copy of the record. Both sides carried a full
 * vacancy on every automatic publication, which made audit_log the largest table in the
 * database while nothing ever read those payloads back. Differing fields are kept, nested
 * objects are compared field by field, and long text is shortened with its original length.
 */
export function auditChange(
  before: unknown,
  after: unknown,
): [unknown, unknown] {
  if (!plainObject(before) || !plainObject(after))
    return [shortened(before), shortened(after)];
  const left: Record<string, unknown> = {};
  const right: Record<string, unknown> = {};
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const a = before[key],
      b = after[key];
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    if (plainObject(a) && plainObject(b)) {
      const [l, r] = auditChange(a, b);
      left[key] = l;
      right[key] = r;
    } else {
      if (key in before) left[key] = shortened(a);
      if (key in after) right[key] = shortened(b);
    }
  }
  return [left, right];
}
export async function audit(
  c: PoolClient,
  jobId: string,
  action: string,
  actor: string,
  before: unknown,
  after: unknown,
) {
  const [from, to] = auditChange(before, after);
  await c.query(
    'INSERT INTO audit_log(job_id,action,actor,before_data,after_data) VALUES($1,$2,$3,$4,$5)',
    [jobId, action, actor, from, to],
  );
}
