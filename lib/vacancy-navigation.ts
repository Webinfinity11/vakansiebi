import { clearBoard } from './board-return-cache';
import { latinUrl } from './latin-url';
import { searchParams, readSearch } from './search-state';
import type { SearchFilters } from './personal-space';
const uuid = /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i;
/* A vacancy's address carries its own name. `/vacancies/<uuid>` said nothing:
   not in a search result, not in a shared link, not to a crawler weighing what
   the page is about. The title leads and the identifier still closes the
   address, so nothing has to be looked up twice and every old link still
   resolves — the page redirects it to the spelling with the name in it. */
export function vacancySlug(title: string) {
  return latinUrl(title)
    .normalize('NFKC')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .slice(0, 7)
    .join('-')
    .slice(0, 70)
    .replace(/-+$/, '');
}
export function vacancySegment(job: { id: string; title?: string }) {
  const slug = job.title ? vacancySlug(job.title) : '';
  return slug ? `${slug}-${job.id}` : job.id;
}
export function vacancyPath(
  job: { id: string; title?: string },
  options: { preview?: boolean; from?: string } = {},
) {
  const params = new URLSearchParams();
  if (options.preview) params.set('preview', '1');
  if (options.from && options.from !== '/')
    params.set('from', safeReturnPath(options.from));
  return (
    `/vacancies/${encodeURIComponent(vacancySegment(job))}` +
    (params.size ? '?' + params : '')
  );
}
/** The identifier an address ends with, whatever name precedes it. */
export function vacancyIdFrom(segment: string) {
  return uuid.exec(segment.slice(-36))?.[0]?.toLowerCase() ?? null;
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
type EntryState = { jobxAt?: number; jobxFromList?: boolean };
/* The address this document was served at. A reader who taps a card before the
   page has woken up gets an ordinary browser navigation instead of a soft one,
   and then the only evidence of what lies below is the referrer. It describes
   this address and no other, so it stops counting the moment the reader moves
   on within the document. */
let loadedAt =
  typeof window === 'undefined' ? null : location.pathname + location.search;
function loadedFromList(expected: string) {
  return (
    location.pathname + location.search === loadedAt &&
    window.history.length > 1 &&
    /* The tab's own first entry has a foreign site below it, whatever the
       referrer says, and is the one entry a step back must never leave from. */
    stampEntry() > 0 &&
    document.referrer === location.origin + safeReturnPath(expected)
  );
}
/* Every public page numbers its own history entry as it loads. The number is
   kept in the entry, so going back, forward, or reloading finds it again, and
   the counter follows the reader rather than the size of the stack, which a
   new push truncates. Adjacent numbers are what proves a vacancy sits directly
   above the list it names. */
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
  window.history.replaceState({ ...state, jobxAt: at }, '');
  return at;
}
export function enterTab() {
  try {
    loadedAt ??= location.pathname + location.search;
    stampEntry();
  } catch {}
}
/* Answers whether "back to the list" may step back instead of pushing the list
   again. A yes needs positive evidence that the entry below is that very list —
   a mark this document made and this entry alone can claim, or a referrer from
   the load that brought the reader here. Anything less keeps the plain link:
   one extra entry costs a reader nothing, and stepping off the site costs them
   everything. The answer is kept in the entry, so a reload or a step forward
   finds it again. */
export function planListReturn(returnTo: string) {
  try {
    const state = window.history.state as EntryState | null;
    if (state?.jobxFromList) return true;
    if (!takeListHop(returnTo) && !loadedFromList(returnTo)) return false;
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
