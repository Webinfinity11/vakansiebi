import { readSearch, readSearchPage } from './search-state';

export function companyFilters(params: URLSearchParams) {
  const search = readSearch(params);
  return {
    query: search.query.trim(),
    city: search.city === 'ყველა' ? '' : search.city.trim(),
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
  if (page > 1) params.set('page', String(page));
  return path + (params.size ? `?${params}` : '');
}
