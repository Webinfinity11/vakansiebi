import { db } from './db';
import { searchPlan } from './search-plan';
import { cities, cityStem } from '../cities';
import { traitKeys, traits, type TraitKey } from '../seo-landing';

export type DatedVacancy = { id: string; lastModified: Date };

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
    .query<{ id: string; modified: Date }>(
      `${plan.cte} SELECT j.id,COALESCE(record.updated_at,j.published_at,j.created_at) AS modified FROM searchable j JOIN jobs record ON record.id=j.id WHERE ${plan.where} ORDER BY ${plan.ordering},j.id LIMIT 45000`,
      plan.args,
    )
    .then((result) =>
      result.rows.map((r) => ({
        id: r.id,
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

/* How many vacancies each indexable list holds today. A landing page is only
   worth a crawl while it has something on it: an empty "ფინანსების ვაკანსიები
   ფოთში" is a thin page that costs the whole site standing. One pass per
   condition, because each one is a different query to the catalogue; within a
   pass the categories, the cities and their pairs are counted together. */
export type LandingCount = {
  category: string | null;
  city: string | null;
  trait: TraitKey | null;
  count: number;
};
async function countBy(trait: TraitKey | null): Promise<LandingCount[]> {
  const params = new URLSearchParams(
    trait ? [[...traits[trait].param] as [string, string]] : [],
  );
  const plan = searchPlan(params, false, { grouped: true });
  const args = [...plan.args, [...cities], cities.map(cityStem)];
  const names = `$${args.length - 1}::text[]`;
  const stems = `$${args.length}::text[]`;
  // A condition already narrows the list; pairing it with both a category and a
  // city as well leaves pages too alike and too empty to be worth indexing.
  const sets = trait
    ? '((), (category), (city))'
    : '((category), (city), (category, city))';
  const { rows } = await db().query<{
    category: string | null;
    city: string | null;
    count: number;
  }>(
    `${plan.cte}, visible AS MATERIALIZED (
       SELECT j.p_category AS category, j.p_city AS city FROM searchable j WHERE ${plan.where}
     ),
     placed AS (
       SELECT v.category, c.name AS city FROM visible v
       LEFT JOIN LATERAL (
         SELECT t.name FROM unnest(${names}, ${stems}) AS t(name, stem)
         WHERE lower(v.city) LIKE '%' || t.stem || '%' LIMIT 1
       ) c ON true
     )
     SELECT category, city, count(*)::int AS count FROM placed
     GROUP BY GROUPING SETS ${sets}`,
    args,
  );
  return rows.map((row) => ({ ...row, trait }));
}
export async function landingCounts(minimum = 10) {
  const passes = await Promise.all(
    [null, ...traitKeys].map((trait) => countBy(trait)),
  );
  return passes.flat().filter((row) => row.count >= minimum);
}
