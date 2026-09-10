import test from 'node:test';
import assert from 'node:assert/strict';
import {
  vacancyPath,
  safeReturnPath,
  searchReturnPath,
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
