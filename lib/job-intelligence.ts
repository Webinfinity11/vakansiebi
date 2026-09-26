import type { Vacancy } from './types';

const georgianWord = /^[ა-ჰ]+$/u;
const cyrillic = /[Ѐ-ӿ]/u;
const shortTechnicalToken = /^[a-z0-9#+.]{2}$/;
// English glue words: "bank of georgia" is about the bank, not about "of".
const latinStopwords = new Set([
  'of',
  'the',
  'and',
  'in',
  'at',
  'for',
  'to',
  'an',
  'on',
]);
/**
 * Query tokens. One- and two-letter Georgian or Cyrillic fragments (ის, და, по)
 * occur inside nearly every text and are dropped unless they are all the user
 * typed; two-character Latin abbreviations (hr, qa, c#, 1c) are real job terms.
 */
export function searchTerms(query: string): string[] {
  const tokens = [
    ...new Set(
      (
        query
          .normalize('NFKC')
          .toLowerCase()
          // One name written apart: "ქოლ-ცენტრის", "call center" are one word to search.
          .replace(/ქოლ[\s-]+ცენტრ/gu, 'ქოლცენტრ')
          .replace(/\bcall[\s-]+cent(?:er|re)s?\b/gu, 'ქოლცენტრ')
          .match(/[\p{L}\p{N}+#.]+/gu) || []
      )
        /* A dot keeps .net and node.js whole, but between Georgian letters it is a missing
           space ("მცხობელი.მზარეული"), and at either end of a Georgian word it is punctuation. */
        .flatMap((token) => token.split(/(?<=[ა-ჰ])\.+(?=[ა-ჰ])/u))
        .map((token) =>
          /[ა-ჰ]/u.test(token) ? token.replace(/^\.+|\.+$/g, '') : token,
        )
        // A lone "." or "..." is punctuation, not a word to look for.
        .filter((token) => /[\p{L}\p{N}]/u.test(token)),
    ),
  ];
  const meaningful = tokens.filter(
    (token) =>
      !latinStopwords.has(token) &&
      /[\p{L}\p{N}]/u.test(token) &&
      (token.length >= 3 || shortTechnicalToken.test(token)),
  );
  return (meaningful.length ? meaningful : tokens).slice(0, 12);
}
/** Quotes PostgreSQL ARE metacharacters so a user term is matched literally. */
export function escapeRegex(value: string) {
  return value.replace(/[\\^$.|?*+()[\]{}#&~-]/g, '\\$&');
}
/**
 * How a search alternative is matched inside a normalized document.
 * - Georgian stems inflect by suffix, so a stem of three or more letters is a
 *   plain substring (null pattern, strpos only).
 * - Anything else must start at a word boundary. Short Latin tokens (java, php,
 *   c#, .net) are whole words, otherwise "java" finds javascript and surnames;
 *   longer Latin and every Cyrillic token is a word prefix (бухгалтер → бухгалтера).
 */
export function termPattern(term: string): string | null {
  // Hyphens appear only in reviewed spellings such as "ქოლ-ცენტრ".
  const georgian = /^[ა-ჰ][ა-ჰ\s-]*$/u.test(term);
  if (georgian && term.length >= 6) return null;
  /* A short stem is the start of a word, never the inside of one: "ოფის" must not find
     "განყოფილების", "დაცვ" not "ჯანდაცვის". Two letters reach here only as the whole
     query, a reader still typing "მძ". Georgian letters are spelled out because a C
     collation does not count them as word characters. */
  if (georgian) return '(^|[^[:alnum:]ა-ჰ])' + escapeRegex(term);
  const whole = georgian || (term.length < 5 && !cyrillic.test(term));
  const lead = /^[\p{L}\p{N}]/u.test(term) ? '\\m' : '';
  let trail = '';
  if (whole)
    trail = /[\p{L}\p{N}]$/u.test(term)
      ? (/^[a-z]+$/.test(term) ? '(e?s)?' : '') + '\\M'
      : '($|[^[:alnum:]_])';
  return lead + escapeRegex(term) + trail;
}
/**
 * Where an alternative is allowed to match. A two- or three-letter token is a
 * fragment of ordinary prose as often as it is a job: "hr" appears in the reply
 * address of 1,524 descriptions and in only 43 titles, and a three-letter
 * Georgian stem is a substring of unrelated words. Those are read as the name of
 * a role, so they are matched against the title and employer only; everything
 * longer still searches the whole description.
 */
export function termScope(term: string): 'head' | 'document' {
  return term.length <= 3 ? 'head' : 'document';
}
export const isGeorgianWord = (value: string) => georgianWord.test(value);
export const isCyrillicWord = (value: string) => /^[Ѐ-ӿ]+$/u.test(value);
const text = (value: string) =>
  value.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
// Only identical posting cycles and content can be linked automatically.
// Similar titles alone are deliberately insufficient evidence.
const entries = (values: unknown) =>
  JSON.stringify(
    Array.isArray(values)
      ? values.map((value) => JSON.stringify(value)).sort()
      : [],
  );
export function samePosting(a: Vacancy, b: Vacancy): boolean {
  if (
    !a.company.trim() ||
    !a.city.trim() ||
    !a.datePosted ||
    !a.deadline ||
    a.description.length < 80
  )
    return false;
  return (
    (
      [
        'title',
        'company',
        'city',
        'description',
        'datePosted',
        'deadline',
        'salary',
        'currency',
        'salaryPeriod',
        'mode',
        'employmentType',
      ] as const
    ).every((key) => text(a[key] || '') === text(b[key] || '')) &&
    a.salaryMin === b.salaryMin &&
    entries(a.facts) === entries(b.facts) &&
    entries(a.applicationLinks) === entries(b.applicationLinks)
  );
}
export type SourceHealth = 'recent' | 'stale' | 'unavailable' | 'unknown';
export function sourceHealth(
  checked: string | null,
  error: string | null,
  now = Date.now(),
): SourceHealth {
  if (error) return 'unavailable';
  const at = checked ? Date.parse(checked) : NaN;
  if (!Number.isFinite(at) || at > now + 60000) return 'unknown';
  return now - at <= 48 * 3600000 ? 'recent' : 'stale';
}
