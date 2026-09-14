import test from 'node:test';
import assert from 'node:assert/strict';
import {
  vacancyPath,
  safeReturnPath,
  searchReturnPath,
  readSearchPosition,
} from '../lib/vacancy-navigation';
import { readSearch } from '../lib/search-state';
import { getVacancyPage } from '../lib/server/vacancy-page';
void test('vacancy links keep search context separate from their stable share URL', () => {
  const id = 'a7f16c4c-5d47-4a08-8fa5-9e7b5a46664c';
  assert.equal(vacancyPath(id), '/vacancies/' + id);
  const from = searchReturnPath(
    readSearch(new URLSearchParams('q=developer&salaryPeriod=day')),
    3,
    true,
  );
  const url = new URL(
    vacancyPath(id, { from, preview: true }),
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
    readSearchPosition(stored({ loadedThrough: 12 }), url, at),
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
