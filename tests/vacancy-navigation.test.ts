import test from 'node:test';
import assert from 'node:assert/strict';
import {
  vacancyPath,
  safeReturnPath,
  searchReturnPath,
  readSearchPosition,
  markListHop,
  planListReturn,
  enterTab,
  canStepBack,
  vacancyIdFrom,
} from '../lib/vacancy-navigation';
import { readSearch } from '../lib/search-state';
import { getVacancyPage } from '../lib/server/vacancy-page';
void test('vacancy links keep search context separate from their stable share URL', () => {
  const id = 'a7f16c4c-5d47-4a08-8fa5-9e7b5a46664c';
  assert.equal(vacancyPath({ id }), '/vacancies/' + id);
  // The name leads and the identifier closes the address.
  assert.equal(
    decodeURIComponent(vacancyPath({ id, title: 'მოლარე-კონსულტანტი' })),
    `/vacancies/მოლარე-კონსულტანტი-${id}`,
  );
  assert.equal(vacancyIdFrom(`მოლარე-კონსულტანტი-${id}`), id);
  assert.equal(vacancyIdFrom(id.toUpperCase()), id);
  assert.equal(vacancyIdFrom('მოლარე'), null);
  // A title of punctuation alone leaves the identifier to name the page.
  assert.equal(vacancyPath({ id, title: '!!! ???' }), '/vacancies/' + id);
  const from = searchReturnPath(
    readSearch(new URLSearchParams('q=developer&salaryPeriod=day')),
    3,
    true,
  );
  const url = new URL(
    vacancyPath({ id }, { from, preview: true }),
    'https://example.com',
  );
  assert.equal(url.searchParams.get('from'), from);
  assert.equal(url.searchParams.get('preview'), '1');
  assert.equal(
    new URL(from, 'https://example.com').searchParams.get('page'),
    '3',
  );
});
void test('return navigation never accepts another origin, path, or a recursive legacy job link', () => {
  for (const unsafe of [
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    '/admin',
    '/vacancies/x',
    'javascript:alert(1)',
  ])
    assert.equal(safeReturnPath(unsafe), '/');
  assert.equal(
    safeReturnPath('/?job=a7f16c4c-5d47-4a08-8fa5-9e7b5a46664c'),
    '/',
  );
  assert.equal(safeReturnPath('/?q=developer&unknown=x'), '/?q=developer');
});
void test('malformed vacancy identifiers never issue a database lookup', async () => {
  assert.equal(await getVacancyPage('invalid'), null);
});
void test('a remembered list position keeps the pages appended with "load more"', () => {
  const id = 'a7f16c4c-5d47-4a08-8fa5-9e7b5a46664c';
  const url = '/?q=developer&page=2';
  const at = 1_000_000;
  const stored = (extra: object) =>
    JSON.stringify({ url, id, page: 2, top: 640, at, ...extra });
  assert.deepEqual(readSearchPosition(stored({ loadedThrough: 4 }), url, at), {
    id,
    page: 2,
    loadedThrough: 4,
    top: 640,
  });
  // Records written before the field existed restore a single page.
  assert.equal(readSearchPosition(stored({}), url, at)?.loadedThrough, 2);
  // A range below the first page or unreasonably long is refused rather than fetched.
  assert.equal(readSearchPosition(stored({ loadedThrough: 1 }), url, at), null);
  assert.equal(
    readSearchPosition(stored({ loadedThrough: 52 }), url, at),
    null,
  );
  assert.equal(
    readSearchPosition(stored({ loadedThrough: 3 }), '/?q=other', at),
    null,
  );
});

void test('an employer page is a safe place to return to, and nothing shaped like one leaves the site', async () => {
  const { safeReturnPath } = await import('../lib/vacancy-navigation');
  const slug = encodeURIComponent('ლიბერთი-ბანკი');
  assert.equal(safeReturnPath(`/companies/${slug}`), `/companies/${slug}`);
  assert.equal(
    safeReturnPath(`/companies/${slug}?page=3&x=1`),
    `/companies/${slug}?page=3`,
  );
  assert.equal(
    safeReturnPath(`/companies/${slug}?page=-2`),
    `/companies/${slug}`,
  );
  for (const bad of [
    '//evil.test/companies/x',
    '/companies/x/../../admin',
    '/companies/',
    '/companies/a/b',
    'https://evil.test/companies/x',
    '/\\evil.test/companies/x',
  ])
    assert.ok(
      !safeReturnPath(bad).includes('evil') &&
        !safeReturnPath(bad).includes('admin'),
      bad,
    );
});

void test('return position preserves the clicked card offset and ignores invalid offsets', () => {
  const state = {
    url: '/',
    id: 'a7f16c4c-5d47-4a08-8fa5-9e7b5a46664c',
    page: 1,
    loadedThrough: 3,
    top: 1200,
    at: 1000,
  };
  assert.equal(
    readSearchPosition(
      JSON.stringify({ ...state, anchorOffset: 180 }),
      '/',
      1000,
    )?.anchorOffset,
    180,
  );
  assert.equal(
    readSearchPosition(
      JSON.stringify({ ...state, anchorOffset: 'bad' }),
      '/',
      1000,
    )?.anchorOffset,
    undefined,
  );
});

/* The one outcome a reader must never meet is a back control that takes them
   off the site, so every way the decision can be reached is pinned here. */
function tab(entries: { state: unknown }[] = [{ state: null }]) {
  const store = new Map<string, string>();
  let at = entries.length - 1;
  const history = {
    get state() {
      return entries[at]!.state;
    },
    get length() {
      return entries.length;
    },
    replaceState(state: unknown) {
      entries[at]!.state = state;
    },
    push(state: unknown = null) {
      entries = entries.slice(0, at + 1);
      entries.push({ state });
      at = entries.length - 1;
    },
    go(step: number) {
      at = Math.max(0, Math.min(entries.length - 1, at + step));
    },
  };
  Object.assign(globalThis, {
    window: { history },
    location: { pathname: '/', search: '', origin: 'https://jobx.ge' },
    document: { referrer: '' },
    sessionStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
  });
  return history;
}
void test('a vacancy the list opened steps back onto it, however often the reader returns', () => {
  const history = tab();
  enterTab(); // the list is the tab's first page
  assert.deepEqual(history.state, { jobxAt: 0 });
  for (let visit = 1; visit <= 3; visit++) {
    markListHop('/?q=dev');
    history.push(); // the vacancy is opened on top of the list
    enterTab();
    assert.equal(planListReturn('/?q=dev'), true, `visit ${visit}`);
    assert.equal(canStepBack(), true);
    // The answer is the entry's own, so leaving and returning to it does not change it.
    assert.equal(planListReturn('/?q=dev'), true);
    history.go(-1); // "back to the list" steps back rather than pushing
  }
  assert.equal(history.length, 2, 'three visits, and history never grew');
});
void test('a vacancy without a list below it keeps the plain link', () => {
  // Straight from a search engine: the tab's first entry, another site behind it.
  const history = tab();
  enterTab();
  markListHop('/'); // even a matching mark cannot unlock the first entry
  assert.equal(planListReturn('/'), false);
  assert.deepEqual(history.state, { jobxAt: 0 });
  // A mark left by a tap that never became a visit names another list.
  tab([{ state: { jobxAt: 4 } }]);
  markListHop('/?q=dev');
  history.push();
  assert.equal(planListReturn('/companies/acme'), false);
  // And it is spent either way, so the next page cannot claim it.
  assert.equal(planListReturn('/?q=dev'), false);
});
void test('a mark is not claimable from further up the stack', () => {
  const history = tab([{ state: { jobxAt: 2 } }]);
  enterTab();
  markListHop('/?q=dev');
  history.push(); // a detour — another site, or another page of ours
  enterTab();
  history.push(); // and only then the vacancy
  enterTab();
  assert.equal(planListReturn('/?q=dev'), false);
});
void test('a restored tab with no step behind it never steps back', () => {
  tab([{ state: { jobxAt: 3, jobxFromList: true } }]);
  assert.equal(planListReturn('/?q=dev'), true);
  assert.equal(canStepBack(), false);
});
void test('an unclaimed mark goes stale instead of turning a later visit into a step back', () => {
  const history = tab();
  enterTab();
  markListHop('/');
  const stored = JSON.parse(sessionStorage.getItem('ertad-list-hop') as string);
  sessionStorage.setItem(
    'ertad-list-hop',
    JSON.stringify({ ...stored, at: stored.at - 200000 }),
  );
  history.push();
  enterTab();
  assert.equal(planListReturn('/'), false);
});
