import { clearBoard } from './board-return-cache';
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
/* An employer's page is the other place a vacancy is opened from. Only its own shape is accepted —
   one slug segment and a page number — so the value can never lead off the site. */
function companyReturnPath(value: string) {
  try {
    const url = new URL(value, 'https://vacancy.local');
    const slug = /^\/companies\/([^/]{1,240})$/.exec(url.pathname)?.[1];
    if (
      url.origin !== 'https://vacancy.local' ||
      !slug ||
      !value.startsWith('/companies/')
    )
      return null;
    const page = Math.floor(Number(url.searchParams.get('page')));
    return `/companies/${slug}${page > 1 && page <= 10000 ? `?page=${page}` : ''}`;
  } catch {
    return null;
  }
}
export function safeReturnPath(value?: string) {
  const company =
    value && value.length <= 4000 ? companyReturnPath(value) : null;
  if (company) return company;
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
const hop = 'ertad-list-hop';
const cursor = 'ertad-entry-at';
/* A vacancy opened from a list sits one step above it in history, so its "back
   to the list" control steps back rather than pushing the list again: two visits
   in a row used to leave four entries behind, and a reader walking out with the
   phone's back button had to pass through vacancies they had already closed
   before leaving the site — which is what it felt like being thrown out.

   Stepping back is only safe when the entry below really is the list, so the
   mark names the list it was left from and expires: a tap that never became a
   visit, or a vacancy opened later from a search engine, finds nothing to claim
   and keeps the plain link. */
export function markListHop(from: string) {
  sameDocument = true;
  try {
    sessionStorage.setItem(
      hop,
      JSON.stringify({
        from: safeReturnPath(from),
        index: stampEntry(),
        at: Date.now(),
      }),
    );
  } catch {}
}
/* Claimed by the page the list opened, and by no other. The list's own address
   has to match, the claim has to be prompt, the entry has to be the one directly
   above the list's, and the document must never have been left in between — a
   tap that did not become a visit leaves its mark behind, and a vacancy reached
   afterwards from a search result would otherwise claim it and step back off
   jobx.ge, which is being thrown out of the site. */
function takeListHop(expected: string) {
  try {
    const raw = sessionStorage.getItem(hop);
    sessionStorage.removeItem(hop);
    const mark = JSON.parse(raw || 'null');
    return (
      sameDocument &&
      !!mark &&
      mark.from === safeReturnPath(expected) &&
      mark.index === stampEntry() - 1 &&
      Number.isFinite(mark.at) &&
      Date.now() - mark.at < 120000
    );
  } catch {
    return false;
  }
}
/* A soft navigation keeps the document, and with it this flag: a mark made here
   can only be claimed by a page the reader reached without leaving. */
let sameDocument = false;
type EntryState = {
  jobxAt?: number;
  jobxRoot?: boolean;
  jobxFromList?: boolean;
};
/* Every public page numbers its own history entry as it loads. The number is
   kept in the entry, so going back, forward, or reloading finds it again, and
   the counter follows the reader rather than the size of the stack — which a
   new push truncates. Entry zero is the tab's first page: there is nothing
   behind it but another site, so nothing here may ever step back from it. */
function stampEntry() {
  const state = (window.history.state ?? null) as EntryState | null;
  if (typeof state?.jobxAt === 'number') {
    sessionStorage.setItem(cursor, String(state.jobxAt));
    return state.jobxAt;
  }
  /* An absent counter is the tab's first page, not entry zero of a stack that
     already exists: `Number(null)` is 0, which would leave the first entry
     unmarked and its back control free to step off the site. */
  const seen = sessionStorage.getItem(cursor);
  const previous = seen === null ? -1 : Math.floor(Number(seen));
  const at = (Number.isFinite(previous) ? Math.max(-1, previous) : -1) + 1;
  sessionStorage.setItem(cursor, String(at));
  window.history.replaceState(
    { ...state, jobxAt: at, ...(at === 0 ? { jobxRoot: true } : {}) },
    '',
  );
  return at;
}
export function enterTab() {
  try {
    stampEntry();
  } catch {}
}
/* Answers, once per history entry, whether "back to the list" may step back.
   The answer is kept in the entry itself, so it survives a reload and going
   back and forward again, and is never decided twice. */
export function planListReturn(returnTo: string) {
  try {
    const state = window.history.state as EntryState | null;
    if (state?.jobxRoot) return false;
    if (state?.jobxFromList) return true;
    if (!takeListHop(returnTo)) return false;
    window.history.replaceState(
      { ...window.history.state, jobxFromList: true },
      '',
    );
    return true;
  } catch {
    return false;
  }
}
/* Even a marked entry is only stepped back over while history holds something
   below it. */
export function canStepBack() {
  return typeof window !== 'undefined' && window.history.length > 1;
}
/* `loadedThrough` is the last page appended with "load more"; the URL keeps the first page,
   so returning to the list has to know how many pages to fetch again before scrolling. */
export function rememberSearch(
  url: string,
  id: string,
  page: number,
  loadedThrough = page,
) {
  markListHop(url);
  try {
    // The board restores its anchor after all previously loaded pages return.
    // Native history restoration would otherwise race this asynchronous layout.
    window.history.scrollRestoration = 'manual';
    sessionStorage.setItem(
      key,
      JSON.stringify({
        url: safeReturnPath(url),
        id,
        page,
        loadedThrough: Math.max(page, loadedThrough),
        top: window.scrollY,
        anchorOffset: document
          .querySelector(`[data-vacancy-id="${id}"]`)
          ?.getBoundingClientRect().top,
        at: Date.now(),
      }),
    );
  } catch {}
}
export type SearchPosition = {
  id: string;
  page: number;
  loadedThrough: number;
  top: number;
  anchorOffset?: number;
};
export function readSearchPosition(
  raw: string | null,
  url: string,
  now = Date.now(),
): SearchPosition | null {
  try {
    const state = JSON.parse(raw || 'null');
    if (
      state?.url !== safeReturnPath(url) ||
      !uuid.test(state.id) ||
      !Number.isFinite(state.top) ||
      state.top < 0 ||
      !Number.isInteger(state.page) ||
      state.page < 1 ||
      !Number.isFinite(state.at) ||
      state.at > now ||
      now - state.at > 7200000
    )
      return null;
    const loadedThrough =
      state.loadedThrough === undefined ? state.page : state.loadedThrough;
    if (
      !Number.isInteger(loadedThrough) ||
      loadedThrough < state.page ||
      loadedThrough > state.page + 49
    )
      return null;
    return {
      id: state.id,
      page: state.page,
      loadedThrough,
      top: state.top,
      ...(Number.isFinite(state.anchorOffset)
        ? { anchorOffset: state.anchorOffset }
        : {}),
    };
  } catch {
    return null;
  }
}
export function restoreSearch(url: string): SearchPosition | null {
  try {
    return readSearchPosition(sessionStorage.getItem(key), url);
  } catch {
    return null;
  }
}

export function clearSearchPosition() {
  clearBoard();
  try {
    sessionStorage.removeItem(key);
  } catch {}
}
