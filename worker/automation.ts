import type { PoolClient } from 'pg';
import { vacancySchema } from '../lib/vacancy-schema';
import {
  employerlessSources,
  sourceNames,
  type ActiveSourceId,
  type Vacancy,
} from '../lib/types';
import { externalId, fingerprint, tbilisiDate } from './adapters';
import { auditChange } from './importer';
import { db, transaction } from '../lib/server/db';
import { safeLogoUrl } from '../lib/vacancy-media';

export function publishable(
  raw: unknown,
  source: string,
  url: string,
  today = tbilisiDate(),
): Vacancy | null {
  // Optional image metadata must not hide an otherwise valid vacancy.
  // Keep the URL restrictions: unsupported images are omitted, not rendered.
  const candidate =
    raw && typeof raw === 'object' && 'logoUrl' in raw
      ? { ...raw, logoUrl: safeLogoUrl(raw.logoUrl) }
      : raw;
  const parsed = vacancySchema.safeParse(candidate);
  if (!parsed.success || !(source in sourceNames)) return null;
  const v = parsed.data;
  // A classified board has no employer to verify, only a contact inside the advertisement.
  if (
    (!v.company.trim() && !employerlessSources.includes(v.source)) ||
    v.url !== url ||
    v.source !== sourceNames[source as ActiveSourceId]
  )
    return null;
  try {
    if (!externalId(source as ActiveSourceId, url)) return null;
  } catch {
    return null;
  }
  if (
    (v.deadline && v.deadline < today) ||
    (v.datePosted && v.datePosted > today)
  )
    return null;
  // An unknown location/logo/pay is an honest omission, not a reason to invent it.
  return v;
}

export async function reconcileJob(c: PoolClient, id: string) {
  const job = (await c.query('SELECT * FROM jobs WHERE id=$1 FOR UPDATE', [id]))
    .rows[0];
  if (
    !job ||
    job.automation_paused ||
    ['rejected', 'merged'].includes(job.status)
  )
    return 'skipped';
  const items = (
    await c.query(
      `SELECT i.*,s.auto_publish FROM source_items i JOIN sources s ON s.id=i.source_id
    WHERE i.job_id=$1 AND s.enabled AND NOT s.retired ORDER BY (i.url=$2) DESC,i.last_verified_at DESC NULLS LAST,i.id`,
      [id, job.draft.url],
    )
  ).rows;
  if (!items.some((i) => i.auto_publish)) return 'skipped';
  await c.query('UPDATE jobs SET automation_checked_at=now() WHERE id=$1', [
    id,
  ]);
  if (!job.automation_managed && job.status !== 'pending') return 'skipped';
  const now = Date.now();
  const lastGood = Math.max(
    0,
    ...items.map((i) =>
      i.last_verified_at ? new Date(i.last_verified_at).getTime() : 0,
    ),
  );
  const qualityGrace = now - lastGood <= 7 * 86400000;
  const primaryHeld = items.some(
    (i) => i.url === job.draft.url && i.quality_warning && !i.error,
  );
  if (
    primaryHeld &&
    qualityGrace &&
    !(job.draft.deadline && job.draft.deadline < tbilisiDate())
  )
    return 'quality_held';
  const fresh = items.filter(
    (i) =>
      i.auto_publish &&
      !i.error &&
      !i.quality_warning &&
      i.last_verified_at &&
      now - new Date(i.last_verified_at).getTime() <= 48 * 3600000,
  );
  const candidate = fresh
    .map((i) => publishable(i.raw, i.source_id, i.url))
    .find(Boolean);
  let status = job.status;
  let reason: string | null = null;
  let draft = job.draft;
  let published = job.published;
  if (candidate) {
    status = 'published';
    draft = candidate;
    published = candidate;
  } else {
    // A valid previous snapshot stays intact during independent quality rechecks; normal expiry still applies.
    if (
      qualityGrace &&
      items.some((i) => i.quality_warning && !i.error) &&
      !items.every((i) => i.raw?.deadline && i.raw.deadline < tbilisiDate())
    )
      return 'quality_held';
    const today = tbilisiDate();
    const allExpired =
      items.length > 0 &&
      items.every((i) => i.raw?.deadline && i.raw.deadline < today);
    const allRemoved =
      items.length > 0 &&
      items.every((i) =>
        /^(Source returned HTTP (404|410)|Source vacancy unavailable)$/.test(
          i.error || '',
        ),
      );
    if (
      allExpired ||
      allRemoved ||
      (job.automation_managed && now - lastGood > 7 * 86400000)
    ) {
      status = 'archived';
      reason = allExpired ? 'expired' : allRemoved ? 'removed' : 'unverified';
      published = null;
    } else if (fresh.length) {
      status = 'pending';
      reason = 'invalid_source_data';
      published = null;
    } else if (job.status === 'pending') {
      reason = 'awaiting_source';
    } else return 'unchanged'; // Short network outages do not remove verified vacancies.
  }
  // jsonb key order differs from parsed objects: compare semantically in PostgreSQL.
  const changed = await c.query(
    `UPDATE jobs SET draft=$2,published=$3,status=$4,needs_review=false,automation_managed=true,
    automation_reason=$5,fingerprint=$6,version=version+1,updated_at=now(),
    published_at=CASE WHEN $4='published' AND status<>'published' THEN now() ELSE published_at END
    WHERE id=$1 AND (draft IS DISTINCT FROM $2::jsonb OR published IS DISTINCT FROM $3::jsonb OR status<>$4
      OR automation_reason IS DISTINCT FROM $5::text OR needs_review OR NOT automation_managed)`,
    [id, draft, published, status, reason, fingerprint(draft)],
  );
  if (!changed.rowCount) return 'unchanged';
  const [from, to] = auditChange(
    { status: job.status, published: job.published },
    { status, published, reason },
  );
  await c.query(
    `INSERT INTO audit_log(job_id,action,actor,before_data,after_data) VALUES($1,$2,'automation',$3,$4)`,
    [id, 'automation.' + status, from, to],
  );
  return status;
}

export async function reconcileSource(source: string) {
  const ids = (
    await db().query(
      `SELECT j.id FROM jobs j WHERE NOT j.automation_paused AND j.status IN ('pending','published','archived')
    AND EXISTS(SELECT 1 FROM source_items i JOIN sources s ON s.id=i.source_id WHERE i.job_id=j.id AND i.source_id=$1 AND s.auto_publish AND s.enabled AND NOT s.retired)
    ORDER BY j.automation_checked_at NULLS FIRST,j.id LIMIT 500`,
      [source],
    )
  ).rows;
  const results: Record<string, number> = {};
  for (let offset = 0; offset < ids.length; offset += 4) {
    const batch = await Promise.all(
      ids
        .slice(offset, offset + 4)
        .map(({ id }) => transaction((c) => reconcileJob(c, id))),
    );
    for (const result of batch) results[result] = (results[result] || 0) + 1;
  }
  return results;
}
