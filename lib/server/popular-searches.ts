import { cache } from 'react';
import { db } from './db';
import { searchPlan } from './search-plan';
import { roleVocabulary } from '../search-language';

/* What to offer a reader who has opened the search field and typed nothing yet.
   A raw search log is the wrong source — it is mostly typos, one-off phrasings
   and words the catalogue cannot answer. These are the reviewed roles, ranked by
   how many vacancies each one actually leads to today, so every chip is a
   promise the results page keeps. */
export const popularSearches = cache(async (limit = 18) => {
  const plan = searchPlan(new URLSearchParams(), false, { grouped: true });
  const args = [...plan.args];
  const values = roleVocabulary
    .map(({ label, stem }) => {
      args.push(label, '%' + stem.replace(/[\\%_]/g, (c) => '\\' + c) + '%');
      return `($${args.length - 1},$${args.length})`;
    })
    .join(',');
  const { rows } = await db().query(
    `${plan.cte}, visible AS MATERIALIZED (SELECT j.p_title AS title FROM searchable j WHERE ${plan.where})
     SELECT r.label, count(*)::int AS count
     FROM visible v JOIN (VALUES ${values}) AS r(label,pattern)
       ON v.title ILIKE r.pattern ESCAPE '\\'
     GROUP BY r.label
     HAVING count(*) >= 12
     ORDER BY count DESC, r.label
     LIMIT ${Math.max(1, Math.min(40, limit))}`,
    args,
  );
  return rows as { label: string; count: number }[];
});
