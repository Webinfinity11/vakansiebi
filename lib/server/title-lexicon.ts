import { publicRead } from './search-plan';

/* The words vacancy titles actually use, with how many published titles carry each: the
   spelling a correction may offer beyond the reviewed roles. Read only when a search finds
   nothing, kept for six hours per instance, so it never adds a database wake of its own. */
const ttl = 6 * 60 * 60 * 1000;
let cached: { at: number; words: Map<string, number> } | null = null;
let pending: Promise<Map<string, number>> | null = null;

export async function titleLexicon(): Promise<Map<string, number>> {
  if (cached && Date.now() - cached.at < ttl) return cached.words;
  pending ??= publicRead(
    `SELECT word, count(*)::int n FROM (
       SELECT DISTINCT j.id, w AS word
       FROM jobs j, regexp_split_to_table(lower(normalize(j.search_title, NFKC)), '[^ა-ჰa-z]+') w
       WHERE j.status='published' AND j.search_title IS NOT NULL
     ) t WHERE length(word) BETWEEN 5 AND 30 GROUP BY word HAVING count(*) >= 3`,
  )
    .then(({ rows }) => {
      const words = new Map<string, number>(
        rows.map((row: { word: string; n: number }) => [row.word, row.n]),
      );
      cached = { at: Date.now(), words };
      return words;
    })
    .catch(() => cached?.words ?? new Map<string, number>())
    .finally(() => {
      pending = null;
    });
  return pending;
}
