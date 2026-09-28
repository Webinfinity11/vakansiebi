import test from 'node:test';
import assert from 'node:assert/strict';
import { companyFilters, companyResultsPath } from '../lib/company-filters';
import { companyVacancyTitle } from '../lib/company-vacancy-title';
import { employerPage } from '../lib/seo';

void test('company pagination preserves filters and resetting uses the company URL', () => {
  const filters = companyFilters(
    new URLSearchParams({ q: 'მოლარე', city: 'თბილისი', page: '2' }),
  );
  const path = '/companies/example';
  const next = new URL(companyResultsPath(path, filters, 3), 'https://jobx.ge');
  assert.equal(next.pathname, path);
  assert.equal(next.searchParams.get('q'), 'მოლარე');
  assert.equal(next.searchParams.get('city'), 'თბილისი');
  assert.equal(next.searchParams.get('page'), '3');
  assert.equal(
    new URL(companyResultsPath(path, filters, 1), next).searchParams.has(
      'page',
    ),
    false,
  );
  assert.equal(
    companyResultsPath(path, companyFilters(new URLSearchParams())),
    path,
  );
});

void test('company filters reuse search normalization and ignore foreign parameters', () => {
  const filters = companyFilters(
    new URLSearchParams(
      'city=tbilisi&q=%00cashier&page=-1&company=other&saved=1',
    ),
  );
  assert.equal(filters.city, 'თბილისი');
  assert.equal(filters.query, 'cashier');
  assert.equal(filters.page, 1);
  const path = companyResultsPath('/companies/example', filters);
  assert.ok(!path.includes('saved'));
  assert.ok(!path.includes('company='));
});

void test('vacancy headings describe the page without renaming the organization', () => {
  assert.equal(companyVacancyTitle('თიბისი'), 'თიბისის ვაკანსიები');
  assert.equal(
    companyVacancyTitle('საქართველოს ბანკი'),
    'საქართველოს ბანკის ვაკანსიები',
  );
  assert.equal(companyVacancyTitle('Acme & Co'), 'Acme & Co — ვაკანსიები');
  const schema = employerPage({
    name: 'თიბისი',
    path: '/companies/tbc',
    jobs: [],
    total: 0,
  });
  assert.equal(schema[0].name, 'თიბისი');
  assert.equal(schema[1].name, 'თიბისის ვაკანსიები');
});
