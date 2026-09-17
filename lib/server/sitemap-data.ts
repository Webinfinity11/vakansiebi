import { db } from './db';
import { searchPlan } from './search-plan';
import { cities, cityStem } from '../cities';
import { traitKeys, traits, type TraitKey } from '../seo-landing';
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

/* How many vacancies each indexable list holds today. A landing page is only
   worth a crawl while it has something on it: an empty "ფინანსების ვაკანსიები
   ფოთში" is a thin page that costs the whole site standing. One pass per
   condition, because each one is a different query to the catalogue; within a
   pass the categories, the cities and their pairs are counted together. */
export type LandingCount = {
  category: string | null;
  city: string | null;
  trait: TraitKey | null;
  role?: string | null;
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
  // A condition, a field and a city together is a real search; what keeps such
  // a page off the index is its count, not its shape.
  const sets = trait
    ? '((), (category), (city), (category, city))'
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
     GROUP BY GROUPING SETS ${sets}
     /* A grouping set that names a dimension must not answer NULL for it: the
        vacancies whose city is not one of the thirteen would otherwise be
        counted as a second, smaller "this category everywhere". */
     HAVING (GROUPING(category) = 1 OR category IS NOT NULL)
        AND (GROUPING(city) = 1 OR city IS NOT NULL)`,
    args,
  );
  return rows.map((row) => ({ ...row, trait }));
}
/* The professions, counted the way the pages are built: a word from the
   reviewed vocabulary against the titles the catalogue holds, alone and by
   city. One query for all of them — 42 words over one materialised list. */
async function countRoles(): Promise<LandingCount[]> {
  const plan = searchPlan(new URLSearchParams(), false, { grouped: true });
  const args = [...plan.args];
  const roleValues = roleVocabulary
    .map(({ label, stem }) => {
      args.push(label, '%' + stem.replace(/[\\%_]/g, (c) => '\\' + c) + '%');
      return `($${args.length - 1},$${args.length})`;
    })
    .join(',');
  args.push([...cities], cities.map(cityStem));
  const names = `$${args.length - 1}::text[]`;
  const stems = `$${args.length}::text[]`;
  const { rows } = await db().query<{
    role: string;
    city: string | null;
    count: number;
  }>(
    `${plan.cte}, visible AS MATERIALIZED (
       SELECT j.p_title AS title, j.p_city AS city FROM searchable j WHERE ${plan.where}
     ),
     placed AS (
       SELECT r.label AS role, c.name AS city
       FROM visible v
       JOIN (VALUES ${roleValues}) AS r(label,pattern) ON v.title ILIKE r.pattern ESCAPE '\\'
       LEFT JOIN LATERAL (
         SELECT t.name FROM unnest(${names}, ${stems}) AS t(name, stem)
         WHERE lower(v.city) LIKE '%' || t.stem || '%' LIMIT 1
       ) c ON true
     )
     SELECT role, city, count(*)::int AS count FROM placed
     GROUP BY GROUPING SETS ((role), (role, city))
     HAVING GROUPING(city) = 1 OR city IS NOT NULL`,
    args,
  );
  return rows.map((row) => ({
    category: null,
    city: row.city,
    trait: null,
    role: row.role,
    count: row.count,
  }));
}
export async function landingCounts(minimum = 10) {
  const passes = await Promise.all([
    ...[null, ...traitKeys].map((trait) => countBy(trait)),
    countRoles(),
  ]);
  return passes.flat().filter((row) => row.count >= minimum);
}
