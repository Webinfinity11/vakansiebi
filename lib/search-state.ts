import { subcategoryFor } from './subcategories';
import type { SearchFilters } from './personal-space';
import { categories, listingSourceNames } from './types';
/* How many vacancies one page of the list holds. Twenty meant a reader reached
   the end of the list every few seconds of scrolling and had to ask for more;
   the rows are small and the request is a summary, so a longer page costs
   little and interrupts far less. Shared, so the server, the button's count and
   the "showing 1–N" line can never disagree. */
export const listPageSize = 30;
export const sortKeys: Record<string, string> = {
  შესაბამისობა: 'relevance',
  უახლესი: 'new',
  'მაღალი ხელფასი': 'salary',
  'ვადა იწურება': 'deadline',
};
/* Control characters are never part of a typed search, and PostgreSQL refuses a NUL byte in
   text outright: ?city=%00 turned the whole list request into a 500. The two free-text filters
   are cleaned here, where every other filter is already whitelisted. */
const typed = (value: string | null) => (value || '').replace(/\p{Cc}/gu, '');
export function readSearch(params: URLSearchParams): SearchFilters {
  const amount = (key: string) => {
    const value = params.get(key);
    return value && /^\d{1,9}$/.test(value) && Number(value) <= 100000000
      ? Number(value)
      : null;
  };
  const subcategory = subcategoryFor(
    params.get('category') || '',
    params.get('subcategory'),
  );
  return {
    ...(subcategory ? { subcategory: subcategory.id } : {}),
    query: typed(params.get('q')).slice(0, 200),
    city: (typed(params.get('city')) || 'ყველა').slice(0, 300),
    category: (categories as readonly string[]).includes(
      params.get('category') || '',
    )
      ? params.get('category')!
      : 'ყველა',
    source: Object.values(listingSourceNames).includes(
      params.get('source') || '',
    )
      ? params.get('source')!
      : 'ყველა',
    paid: params.get('paid') === 'true',
    remote: params.get('remote') === 'true',
    salaryPeriod: params.get('salaryPeriod') === 'day' ? 'day' : 'month',
    salaryFrom: amount('salaryFrom'),
    salaryTo: amount('salaryTo'),
    employment:
      params.get('employment') === 'part-time'
        ? 'part-time'
        : params.get('employment') === 'internship'
          ? 'internship'
          : params.get('employment') === 'daily'
            ? 'daily'
            : 'all',
    entryLevel: params.get('entryLevel') === 'true',
    deep: params.get('deep') === 'true',
    postedWithin: ([1, 3, 7, 30].includes(Number(params.get('postedWithin')))
      ? Number(params.get('postedWithin'))
      : 0) as SearchFilters['postedWithin'],
    /* Newest first, unless the reader asks otherwise. A job board's value is
       what arrived today; relevance only ever applied to a typed search, and
       even there the newest matching vacancy is usually the one wanted. */
    sort:
      Object.keys(sortKeys).find(
        (key) => sortKeys[key] === params.get('sort'),
      ) || 'უახლესი',
  };
}
export function searchParams(filters: SearchFilters) {
  const result = new URLSearchParams();
  if (filters.query.trim()) result.set('q', filters.query.trim());
  for (const field of ['city', 'category', 'source'] as const)
    if (filters[field] !== 'ყველა') result.set(field, filters[field]);
  const subcategory = subcategoryFor(filters.category, filters.subcategory);
  if (subcategory) result.set('subcategory', subcategory.id);
  if (filters.paid) result.set('paid', 'true');
  if (filters.remote) result.set('remote', 'true');
  if (filters.salaryPeriod === 'day') result.set('salaryPeriod', 'day');
  for (const key of ['salaryFrom', 'salaryTo'] as const)
    if (filters[key] != null) result.set(key, String(filters[key]));
  if (filters.employment !== 'all')
    result.set('employment', filters.employment);
  if (filters.entryLevel) result.set('entryLevel', 'true');
  if (filters.deep) result.set('deep', 'true');
  if (filters.postedWithin)
    result.set('postedWithin', String(filters.postedWithin));
  if (filters.sort !== 'უახლესი')
    result.set('sort', sortKeys[filters.sort] || 'new');
  return result;
}

// The server seed, live filters and return snapshot must identify the same list.
// Page stays separate: changing a filter resets pagination, appending does not.
export function boardSearchKey(
  filters: SearchFilters,
  {
    savedOnly = false,
    saved = [],
    excluded = '',
    preview = false,
  }: {
    savedOnly?: boolean;
    saved?: readonly string[];
    excluded?: string;
    preview?: boolean;
  } = {},
) {
  return JSON.stringify([
    searchParams(filters).toString(),
    savedOnly,
    savedOnly ? [...saved].sort() : [],
    excluded.split(',').filter(Boolean).sort(),
    preview,
  ]);
}

export function readSearchPage(params: Pick<URLSearchParams, 'get'>) {
  return Math.max(
    1,
    Math.min(10000, Math.floor(Number(params.get('page'))) || 1),
  );
}
