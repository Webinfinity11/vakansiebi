/* A list that depends on nothing but the filters is the same list for everyone, and the same
   filters are asked for over and over — the unfiltered first page most of all, which measured
   around two seconds every time. Those answers are held at the edge for a minute and served
   stale for five more while one request refreshes them behind the reader's back.

   Three kinds of request are never cached, because their answer belongs to one person: the
   admin preview, a saved list (`ids`), and a list with someone's hidden vacancies removed
   (`exclude`). Getting this wrong would hand one reader another reader's list, so the rule is
   a whitelist: cache only when none of the three is present. */
import { readSearch, readSearchPage, searchParams } from '../search-state';

export function cacheHeader(params: URLSearchParams) {
  const personal =
    params.get('preview') === '1' || params.has('ids') || params.has('exclude');
  return personal
    ? 'private, no-store'
    : 'public, s-maxage=60, stale-while-revalidate=300';
}

export function publicJobsCacheKey(
  params: URLSearchParams,
  preview = false,
  jobIds?: readonly string[],
) {
  // Internal employer subsets are not described by the URL alone.
  if (
    preview ||
    jobIds ||
    params.has('preview') ||
    params.has('ids') ||
    params.has('exclude')
  )
    return null;
  const normalized = searchParams(readSearch(params));
  normalized.set(
    'page',
    String(params.get('countsOnly') === '1' ? 1 : readSearchPage(params)),
  );
  if (params.get('summary') === '1') normalized.set('summary', '1');
  if (params.get('countsOnly') === '1') normalized.set('countsOnly', '1');
  normalized.sort();
  return normalized.toString();
}

export function createPublicJobsCache<T>(now: () => number = Date.now) {
  const entries = new Map<string, { expiresAt: number; value: Promise<T> }>();
  return {
    clear: () => entries.clear(),
    get(key: string | null, load: () => Promise<T>): Promise<T> {
      if (key === null) return load();
      const existing = entries.get(key);
      if (existing && existing.expiresAt > now()) {
        entries.delete(key);
        entries.set(key, existing);
        return existing.value.then((value) => structuredClone(value));
      }
      entries.delete(key);
      while (entries.size >= 200) entries.delete(entries.keys().next().value!);
      const entry = {
        expiresAt: Infinity,
        value: Promise.resolve().then(load),
      };
      entries.set(key, entry);
      entry.value = entry.value.then(
        (value) => {
          entry.expiresAt = now() + 45_000;
          return value;
        },
        (error) => {
          if (entries.get(key) === entry) entries.delete(key);
          throw error;
        },
      );
      // Callers must not mutate the cached response or another caller's copy.
      return entry.value.then((value) => structuredClone(value));
    },
  };
}
