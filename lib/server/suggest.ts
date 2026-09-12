import { db } from './db';
import { searchPlan } from './search-plan';

export type Suggestion = {
  value: string;
  kind: 'title' | 'company';
  count: number;
};

/* One normalised, LIKE-safe prefix, or null when there is nothing worth asking
   the database about. */
export function suggestPrefix(raw: string): string | null {
  const text = raw
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .slice(0, 60);
  return text.length >= 2 ? text : null;
}
export function likePattern(prefix: string) {
  return prefix.replace(/[\\%_]/g, (c) => '\\' + c);
}

/* Titles and employers the visible catalogue actually contains, matched at a
   word start, most frequent first, titles before companies. Nothing is cached
   here: the route sets a short public max-age instead. */
export async function suggestTerms(
  raw: string,
  limit = 8,
): Promise<Suggestion[]> {
  const prefix = suggestPrefix(raw);
  if (!prefix) return [];
  const plan = searchPlan(new URLSearchParams(), false, { grouped: true });
  const args = [...plan.args];
  const bind = (value: unknown) => {
    args.push(value);
    return `$${args.length}`;
  };
  const start = bind(likePattern(prefix) + '%');
  const word = bind('% ' + likePattern(prefix) + '%');
  const n = bind(Math.max(1, Math.min(20, limit)));
  const norm = (sql: string) =>
    `lower(CASE WHEN ${sql} IS NFKC NORMALIZED THEN ${sql} ELSE normalize(${sql},NFKC) END)`;
  const { rows } = await db().query(
    `${plan.cte}, visible AS MATERIALIZED (SELECT j.id,j.published FROM searchable j WHERE ${plan.where}),
     candidates AS (
       SELECT btrim(published->>'title') AS value,'title' AS kind,${norm(`btrim(published->>'title')`)} AS norm FROM visible WHERE COALESCE(published->>'title','')<>''
       UNION ALL
       SELECT btrim(published->>'company') AS value,'company' AS kind,${norm(`btrim(published->>'company')`)} AS norm FROM visible WHERE COALESCE(published->>'company','')<>''
     ),
     ranked AS (
       SELECT min(value) AS value,kind,count(*)::int AS count FROM candidates
       WHERE norm LIKE ${start} ESCAPE '\\' OR norm LIKE ${word} ESCAPE '\\'
       GROUP BY norm,kind
     )
     SELECT value,kind,count FROM ranked
     ORDER BY CASE kind WHEN 'title' THEN 0 ELSE 1 END,count DESC,value
     LIMIT ${n}`,
    args,
  );
  return rows.map((r: Suggestion) => ({
    value: String(r.value).slice(0, 120),
    kind: r.kind === 'company' ? 'company' : 'title',
    count: Number(r.count) || 0,
  }));
}
