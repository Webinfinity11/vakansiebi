import { readSearch, readSearchPage, sortKeys } from './search-state';

export const companyFilterKeys = [
  'q',
  'city',
  'category',
  'sort',
  'paid',
  'page',
] as const;

export function companyFilters(params: URLSearchParams) {
  const search = readSearch(params);
  return {
    query: search.query.trim(),
    city: search.city === 'ყველა' ? '' : search.city.trim(),
    category: search.category === 'ყველა' ? '' : search.category,
    sort: sortKeys[search.sort],
    paid: search.paid,
    page: readSearchPage(params),
  };
}

export function companyResultsPath(
  path: string,
  filters: ReturnType<typeof companyFilters>,
  page = filters.page,
) {
  const params = new URLSearchParams();
  if (filters.query) params.set('q', filters.query);
  if (filters.city) params.set('city', filters.city);
  if (filters.category) params.set('category', filters.category);
  if (filters.sort !== 'new') params.set('sort', filters.sort);
  if (filters.paid) params.set('paid', 'true');
  if (page > 1) params.set('page', String(page));
  return path + (params.size ? `?${params}` : '');
}
