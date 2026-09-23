import { db } from './db';
import { searchPlan } from './search-plan';
import { eligibleLandings, type LandingCount } from '../seo-landing';

export type DatedVacancy = { id: string; title: string; lastModified: Date };

let held: { at: number; value: Promise<DatedVacancy[]> } | null = null;
/* The last list that was actually built. A crawler that asks while the database
   is unreachable is better served yesterday's addresses than a 503: Search
   Console remembers a failed fetch for days and retries on its own schedule,
   and every URL in the list is still one the crawler should see. */
let lastGood: DatedVacancy[] | null = null;

/* Every public vacancy with the time its record last changed. The vacancy and company
   sitemaps share this list, so a server builds it once every five minutes. */
export function publicVacancyDates(now = Date.now()) {
  if (held && now - held.at < 300_000) return held.value;
  const plan = searchPlan(new URLSearchParams(), false, { grouped: true });
  const value = db()
    // The title travels with the identifier: the address it builds carries it.
    .query<{ id: string; title: string | null; modified: Date }>(
      `${plan.cte} SELECT j.id,j.p_title AS title,COALESCE(record.updated_at,j.published_at,j.created_at) AS modified FROM searchable j JOIN jobs record ON record.id=j.id WHERE ${plan.where} ORDER BY ${plan.ordering},j.id LIMIT 45000`,
      plan.args,
    )
    .then((result) =>
      result.rows.map((r) => ({
        id: r.id,
        title: r.title || '',
        lastModified: new Date(r.modified),
      })),
    );
  held = { at: now, value };
  value.then(
    (rows) => {
      if (rows.length) lastGood = rows;
    },
    // A failed build is not held, so the next crawler request tries again.
    () => {
      if (held?.value === value) held = null;
    },
  );
  return value;
}
/** The list, or the last one that was built, or nothing at all. */
export async function publicVacancyDatesOrLast(now = Date.now()) {
  try {
    return await publicVacancyDates(now);
  } catch (error) {
    if (lastGood) return lastGood;
    throw error;
  }
}

export function newest(dates: Iterable<Date>) {
  let latest: Date | undefined;
  for (const date of dates) if (!latest || date > latest) latest = date;
  return latest;
}

export type { LandingCount } from '../seo-landing';
export const landingCountsMaxAgeMs = 24 * 60 * 60 * 1000;

/** One small SELECT, with no job search or census on the request path. */
export async function readLandingSnapshot(now = Date.now()) {
  const query = {
    text: 'SELECT category, city, trait, role, count, computed_at FROM landing_counts',
    query_timeout: 2_000,
  };
  const result = await db().query<LandingCount & { computed_at: Date }>(query);
  if (!result.rows.length) throw new Error('Landing counts unavailable');
  const computedAt = new Date(
    Math.min(...result.rows.map((row) => new Date(row.computed_at).getTime())),
  );
  if (
    !Number.isFinite(computedAt.getTime()) ||
    now - computedAt.getTime() > landingCountsMaxAgeMs
  )
    throw new Error('Landing counts stale');
  return { rows: result.rows, computedAt };
}
export async function allLandingCounts(now = Date.now()) {
  return (await readLandingSnapshot(now)).rows;
}
export async function landingCounts() {
  return eligibleLandings(await allLandingCounts());
}
