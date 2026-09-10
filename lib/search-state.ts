import type { SearchFilters } from './personal-space';
import { categories, sourceNames } from './types';
export const sortKeys: Record<string, string> = {
  შესაბამისობა: 'relevance',
  უახლესი: 'new',
  'მაღალი ხელფასი': 'salary',
  'ვადა იწურება': 'deadline',
};
export function readSearch(params: URLSearchParams): SearchFilters {
  const amount = (key: string) => {
    const value = params.get(key);
    return value && /^\d{1,9}$/.test(value) && Number(value) <= 100000000
      ? Number(value)
      : null;
  };
  return {
    query: (params.get('q') || '').slice(0, 200),
    city: (params.get('city') || 'ყველა').slice(0, 300),
    category: categories.includes(params.get('category') || '')
      ? params.get('category')!
      : 'ყველა',
    source: Object.values(sourceNames).includes(params.get('source') || '')
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
    postedWithin: ([1, 3, 7, 30].includes(Number(params.get('postedWithin')))
      ? Number(params.get('postedWithin'))
      : 0) as SearchFilters['postedWithin'],
    sort:
      Object.keys(sortKeys).find(
        (key) => sortKeys[key] === params.get('sort'),
      ) || 'შესაბამისობა',
  };
}
export function searchParams(filters: SearchFilters) {
  const result = new URLSearchParams();
  if (filters.query.trim()) result.set('q', filters.query.trim());
  for (const field of ['city', 'category', 'source'] as const)
    if (filters[field] !== 'ყველა') result.set(field, filters[field]);
  if (filters.paid) result.set('paid', 'true');
  if (filters.remote) result.set('remote', 'true');
  if (filters.salaryPeriod === 'day') result.set('salaryPeriod', 'day');
  for (const key of ['salaryFrom', 'salaryTo'] as const)
    if (filters[key] != null) result.set(key, String(filters[key]));
  if (filters.employment !== 'all')
    result.set('employment', filters.employment);
  if (filters.entryLevel) result.set('entryLevel', 'true');
  if (filters.postedWithin)
    result.set('postedWithin', String(filters.postedWithin));
  if (filters.sort !== 'შესაბამისობა')
    result.set('sort', sortKeys[filters.sort] || 'relevance');
  return result;
}
