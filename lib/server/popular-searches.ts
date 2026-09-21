import { db } from './db';
import { searchPlan } from './search-plan';
import { roleVocabulary, searchMatchGroups } from '../search-language';
import { termPattern } from '../job-intelligence';
import { normalizeEvent } from './analytics';

type Term = { label: string; count: number };
const ttl = 60 * 60 * 1000;
let pending: Promise<Term[]> | null = null;
let expiresAt = 0;

/* Events are normalized on ingestion. Normalize again when reading so legacy
   casing/spacing also counts together, and rejected contact values stay out.
   Raw events cover the entire rolling 30-day window; rollups hold older data. */
async function loadPopularSearches(): Promise<Term[]> {
  const events = await db().query<{ value: string; count: number }>(
    `SELECT value, count(*)::int AS count FROM analytics_events
     WHERE kind='search' AND created_at >= now() - interval '30 days'
     GROUP BY value`,
  );
  const counts = new Map<string, number>();
  for (const event of events.rows) {
    const normalized = normalizeEvent('search', event.value);
    if (normalized)
      counts.set(
        normalized.value,
        (counts.get(normalized.value) ?? 0) + event.count,
      );
  }
  const candidates = [...counts]
    .filter(([, count]) => count >= 3)
    .sort(([a, ac], [b, bc]) => bc - ac || a.localeCompare(b));
  const plan = searchPlan(new URLSearchParams(), false, { grouped: true });
  const args = [...plan.args];
  const values = roleVocabulary
    .map(({ label, stem }) => {
      args.push(label, '%' + stem.replace(/[\\%_]/g, (c) => '\\' + c) + '%');
      return `($${args.length - 1},$${args.length})`;
    })
    .join(',');
  // Search uses these same headline alternatives and word boundaries. Read
  // visible headlines once, instead of rebuilding the catalogue for each term.
  args.push(
    JSON.stringify(
      candidates.map(([label, count]) => ({
        label,
        count,
        groups: searchMatchGroups(label).map((group) =>
          group.all.map((term) => ({
            text: term,
            pattern: termPattern(term),
          })),
        ),
      })),
    ),
  );
  const { rows } = await db().query<Term>(
    `${plan.cte}, visible AS MATERIALIZED (
       SELECT j.p_title AS title, original.search_headline AS headline
       FROM searchable j JOIN jobs original ON original.id=j.id WHERE ${plan.where}
     ), candidates AS (
       SELECT * FROM jsonb_to_recordset($${args.length}::jsonb)
         AS c(label text,count int,groups jsonb)
     ), ranked AS (
       SELECT c.label,c.count,0 AS priority FROM candidates c
       WHERE EXISTS (
         SELECT 1 FROM visible v WHERE NOT EXISTS (
           SELECT 1 FROM jsonb_array_elements(c.groups) g WHERE NOT EXISTS (
             SELECT 1 FROM jsonb_array_elements(g.value) term
             WHERE strpos(v.headline,term->>'text')>0
               AND (term->>'pattern' IS NULL OR v.headline ~ (term->>'pattern'))
           )
         )
       )
       UNION ALL
       (SELECT r.label,count(*)::int AS count,1 AS priority
        FROM visible v JOIN (VALUES ${values}) AS r(label,pattern)
          ON v.title ILIKE r.pattern ESCAPE '\\'
        GROUP BY r.label HAVING count(*) >= 12
        ORDER BY count DESC,r.label LIMIT 40)
     ) SELECT label,count FROM ranked ORDER BY priority,count DESC,label`,
    args,
  );
  const seen = new Set<string>();
  return rows
    .filter(({ label }) => {
      const key = label.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 40);
}

/* Coalesce concurrent misses and keep successful results for an hour after
   completion. A rejected read is immediately retryable; limits share one cache. */
export async function popularSearches(limit = 18): Promise<Term[]> {
  if (!pending || Date.now() >= expiresAt) {
    expiresAt = Infinity;
    pending = loadPopularSearches().then(
      (terms) => {
        expiresAt = Date.now() + ttl;
        return terms;
      },
      (error) => {
        pending = null;
        expiresAt = 0;
        throw error;
      },
    );
  }
  const terms = await pending;
  return terms
    .slice(0, Math.max(1, Math.min(40, limit)))
    .map((term) => ({ ...term }));
}
