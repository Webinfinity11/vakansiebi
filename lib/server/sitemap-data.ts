import { db } from './db';
import { searchPlan } from './search-plan';
import { cities } from '../cities';
import {
  traitKeys,
  traits,
  eligibleLandings,
  type LandingCount,
} from '../seo-landing';
import { categories } from '../types';
import { roleVocabulary } from '../search-language';

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

/* Count the same canonical records as searchPlan. Intersecting independent
   filters preserves city text fallbacks, multi-city jobs and role synonyms;
   title ILIKE and a first-city approximation do not. The canonical group rank
   is independent of filters, so every pass uses the same record identifiers. */
export type { LandingCount } from '../seo-landing';
async function readLandingCounts(): Promise<LandingCount[]> {
  const deadline = Date.now() + 8_000;
  const client = await db().connect();
  let discard = false;
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await client.query("SET LOCAL work_mem = '32MB'");
    // Group ranking is independent of city/trait/role. Compute it once, then
    // apply the unchanged search filters only to those canonical identifiers.
    const matching = async (
      params: URLSearchParams,
      canonicalIds?: string[],
    ) => {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new Error('Landing census deadline exceeded');
      await client.query(`SET LOCAL statement_timeout = '${remaining}ms'`);
      const plan = searchPlan(params, false, {
        grouped: canonicalIds === undefined,
        jobIds: canonicalIds,
      });
      return (
        await client.query<{ id: string; category: string }>(
          `${plan.cte} SELECT j.id,j.p_category AS category FROM searchable j WHERE ${plan.where}`,
          plan.args,
        )
      ).rows;
    };
    const base = await matching(new URLSearchParams());
    const canonicalIds = base.map((row) => row.id);
    const byCity = new Map<string, Set<string>>();
    for (const city of cities)
      byCity.set(
        city,
        new Set(
          (await matching(new URLSearchParams({ city }), canonicalIds)).map(
            (r) => r.id,
          ),
        ),
      );
    const rows: LandingCount[] = [];
    const countPlaces = (
      jobs: typeof base,
      category: string | null,
      trait: LandingCount['trait'],
      role: string | null = null,
    ) => {
      if (category || trait || role)
        rows.push({ category, city: null, trait, role, count: jobs.length });
      for (const city of cities)
        rows.push({
          category,
          city,
          trait,
          role,
          count: jobs.filter((job) => byCity.get(city)!.has(job.id)).length,
        });
    };
    for (const trait of [null, ...traitKeys]) {
      const jobs = trait
        ? await matching(
            new URLSearchParams([[...traits[trait].param]]),
            canonicalIds,
          )
        : base;
      countPlaces(jobs, null, trait);
      for (const category of categories.filter((name) => name !== 'სხვა'))
        countPlaces(
          jobs.filter((job) => job.category === category),
          category,
          trait,
        );
    }
    for (const { label } of roleVocabulary)
      countPlaces(
        await matching(new URLSearchParams({ q: label }), canonicalIds),
        null,
        null,
        label,
      );
    await client.query('COMMIT');
    return rows;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      discard = true;
    }
    throw error;
  } finally {
    client.release(discard);
  }
}

let countsHeld: { at: number; value: Promise<LandingCount[]> } | null = null;
// Shared by the HTML directory and sitemap; coalesce concurrent reads.
export function allLandingCounts(now = Date.now()) {
  if (countsHeld && now - countsHeld.at < 300_000) return countsHeld.value;
  const value = readLandingCounts();
  countsHeld = { at: now, value };
  void value.catch(() => {
    if (countsHeld?.value === value) countsHeld = null;
  });
  return value;
}
export async function landingCounts() {
  return eligibleLandings(await allLandingCounts());
}
