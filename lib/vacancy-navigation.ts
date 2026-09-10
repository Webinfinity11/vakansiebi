import { searchParams, readSearch } from './search-state';
import type { SearchFilters } from './personal-space';
const uuid = /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i;
export function vacancyPath(
  id: string,
  options: { preview?: boolean; from?: string } = {},
) {
  const params = new URLSearchParams();
  if (options.preview) params.set('preview', '1');
  if (options.from && options.from !== '/')
    params.set('from', safeReturnPath(options.from));
  return (
    `/vacancies/${encodeURIComponent(id)}` + (params.size ? '?' + params : '')
  );
}
export function searchReturnPath(
  filters: SearchFilters,
  page = 1,
  saved = false,
  preview = false,
) {
  const params = searchParams(filters);
  if (page > 1) params.set('page', String(page));
  if (saved) params.set('saved', '1');
  if (preview) params.set('preview', '1');
  return '/' + (params.size ? '?' + params : '');
}
export function safeReturnPath(value?: string) {
  if (
    !value ||
    (value !== '/' && !value.startsWith('/?')) ||
    value.length > 4000
  )
    return '/';
  try {
    const url = new URL(value, 'https://vacancy.local');
    if (url.origin !== 'https://vacancy.local' || url.pathname !== '/')
      return '/';
    return searchReturnPath(
      readSearch(url.searchParams),
      Math.max(1, Math.min(10000, Number(url.searchParams.get('page')) || 1)),
      url.searchParams.get('saved') === '1',
      url.searchParams.get('preview') === '1',
    );
  } catch {
    return '/';
  }
}
const key = 'ertad-search-return';
export function rememberSearch(url: string, id: string, page: number) {
  try {
    sessionStorage.setItem(
      key,
      JSON.stringify({
        url: safeReturnPath(url),
        id,
        page,
        top: window.scrollY,
        at: Date.now(),
      }),
    );
  } catch {}
}
export function restoreSearch(
  url: string,
): { id: string; page: number; top: number } | null {
  try {
    const state = JSON.parse(sessionStorage.getItem(key) || 'null');
    if (
      state?.url !== safeReturnPath(url) ||
      !uuid.test(state.id) ||
      !Number.isFinite(state.top) ||
      state.top < 0 ||
      !Number.isInteger(state.page) ||
      state.page < 1 ||
      Date.now() - state.at > 7200000
    )
      return null;
    return state;
  } catch {
    return null;
  }
}
