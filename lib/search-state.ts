import type { SearchFilters } from './personal-space';
import { categories, sourceNames } from './types';
export const sortKeys: Record<string, string> = {
  შესაბამისობა: 'relevance',
  უახლესი: 'new',
  'მაღალი ხელფასი': 'salary',
  'ვადა იწურება': 'deadline',
};
export function readSearch(params: URLSearchParams): SearchFilters {
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
  if (filters.sort !== 'შესაბამისობა')
    result.set('sort', sortKeys[filters.sort] || 'relevance');
  return result;
}
