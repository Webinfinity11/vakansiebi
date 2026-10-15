import { db } from '../lib/server/db';
import type { SourceId } from '../lib/types';
import { listLinks } from './adapters';
import { readDiscoveryInfo, type DiscoverySource } from './discovery';
import { reconcileAndNotify } from './automation';
import { sourceFetch } from './http';

/*
 * New-only collection reads a vacancy once, so a board removing it early went unnoticed:
 * on 2026-10-15, 1,433 published jobs.ge records were no longer on jobs.ge, 1,122 of them
 * still before their deadline. Once a day the full listing of each large board is walked
 * (listing pages only, no detail requests). A vacancy missing from two complete walks at
 * least 20 hours apart is marked removed, and the usual automation archives it unless
 * another board still lists it. A walk that fails or comes back short changes nothing.
 */
export const sweepSources = ['jobs', 'hr', 'ss'] as const;
type SweepSource = (typeof sweepSources)[number];
const SWEEP_HOURS = 20;
const MAX_PAGES = 400;

/** The full listing, in an order that does not reshuffle while it is being walked. */
export function sweepListingUrl(source: SweepSource, page: number) {
  if (source === 'jobs') return `https://jobs.ge/ge/ads/?page=${page}&jid=1`;
  if (source === 'hr') return `https://www.hr.ge/search-posting?pg=${page}`;
  return `https://jobs.ss.ge/ka/l/vacancies?sortBy=OrderDate_desc&page=${page}`;
}

export function isSweepSource(source: SourceId): source is SweepSource {
  return (sweepSources as readonly string[]).includes(source);
}

/**
 * Whether a walk saw enough of the board to call anything missing: within 5% of the count
 * the board reports, or, for jobs.ge which reports none, within 10% of the previous walk.
 */
export function sweepComplete(
  seen: number,
  reported: number | null,
  previous: number | null,
) {
  if (seen === 0) return false;
  if (reported) return seen >= reported * 0.95;
  if (previous) return seen >= previous * 0.9;
  return true;
}

async function walk(source: SweepSource) {
  const ids = new Set<string>();
  const first = await sourceFetch(source, sweepListingUrl(source, 1));
  const info = readDiscoveryInfo(source as DiscoverySource, first);
  const pages = Math.min(MAX_PAGES, info.totalPages || 1);
  for (let page = 1; page <= pages; page++) {
    const url = sweepListingUrl(source, page);
    const html = page === 1 ? first : await sourceFetch(source, url);
    const links = listLinks(source, html, url);
    if (!links.length) break;
    for (const link of links) ids.add(link.externalId);
  }
  return { ids, reported: info.reportedTotal };
}

/** Runs at most once per SWEEP_HOURS per source; returns null when not due. */
export async function sweepRemovals(source: SourceId) {
  if (!isSweepSource(source)) return null;
  const config = (
    await db().query<{
      removal_swept_at: Date | null;
      removal_sweep_count: number | null;
    }>('SELECT removal_swept_at,removal_sweep_count FROM sources WHERE id=$1', [
      source,
    ])
  ).rows[0];
  if (
    config?.removal_swept_at &&
    Date.now() - new Date(config.removal_swept_at).getTime() <
      SWEEP_HOURS * 3600000
  )
    return null;
  let listed: Awaited<ReturnType<typeof walk>>;
  try {
    listed = await walk(source);
  } catch (e) {
    return {
      complete: false,
      seen: 0,
      missing: 0,
      removed: 0,
      error: (e as Error).message,
    };
  }
  const seen = listed.ids.size;
  if (
    !sweepComplete(seen, listed.reported, config?.removal_sweep_count ?? null)
  )
    return { complete: false, seen, missing: 0, removed: 0 };
  const ids = [...listed.ids];
  // Listed again: whatever was noticed missing before was a reshuffle.
  await db().query(
    `UPDATE source_items SET missing_since=NULL
      WHERE source_id=$1 AND missing_since IS NOT NULL AND external_id=ANY($2::text[])`,
    [source, ids],
  );
  // Missing for the second time, a day apart: the board removed it.
  const removed = (
    await db().query<{ id: string; job_id: string }>(
      `UPDATE source_items SET error='Source vacancy unavailable',last_checked_at=now(),
          next_check_at='infinity'::timestamptz
        WHERE source_id=$1 AND job_id IS NOT NULL AND error IS NULL
          AND missing_since < now() - interval '${SWEEP_HOURS} hours'
          AND NOT (external_id=ANY($2::text[]))
        RETURNING id,job_id`,
      [source, ids],
    )
  ).rows;
  // Missing for the first time: remembered, nothing changes yet.
  const missing =
    (
      await db().query(
        `UPDATE source_items si SET missing_since=now()
          FROM jobs j
          WHERE si.source_id=$1 AND si.job_id=j.id AND j.status IN ('published','pending')
            AND si.error IS NULL AND si.missing_since IS NULL
            AND si.discovered_at < now() - interval '6 hours'
            AND NOT (si.external_id=ANY($2::text[]))`,
        [source, ids],
      )
    ).rowCount || 0;
  for (const item of removed) {
    await reconcileAndNotify(item.job_id);
    await archiveRemovedByHand(item.job_id, item.id);
  }
  await db().query(
    'UPDATE sources SET removal_swept_at=now(),removal_sweep_count=$2 WHERE id=$1',
    [source, seen],
  );
  return { complete: true, seen, missing, removed: removed.length };
}

/**
 * A record an editor once changed by hand leaves automation, so reconciliation does not
 * archive it. Gone from every source means gone: archive it here. JOBX's own submissions
 * have no scraped source and are never touched.
 */
export async function archiveRemovedByHand(jobId: string, itemId: string) {
  await db().query(
    `UPDATE jobs SET status='archived',automation_reason='removed',needs_review=false,
      version=version+1,updated_at=now()
     WHERE id=$1 AND automation_paused AND status IN ('pending','published')
       AND NOT EXISTS (SELECT 1 FROM job_submissions sub WHERE sub.job_id=$1)
       AND NOT EXISTS (SELECT 1 FROM source_items o JOIN sources s ON s.id=o.source_id
         WHERE o.job_id=$1 AND o.id<>$2 AND o.error IS NULL AND s.enabled AND NOT s.retired)`,
    [jobId, itemId],
  );
}
