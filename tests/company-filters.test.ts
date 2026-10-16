import test from 'node:test';
import assert from 'node:assert/strict';
import { companyFilters, companyResultsPath } from '../lib/company-filters';
import { companyVacancyTitle } from '../lib/company-vacancy-title';
import { employerPage } from '../lib/seo';
import { companyLocationNames } from '../lib/company-locations';

void test('company filters retain category, salary and sort across pagination', () => {
  const filters = companyFilters(
    new URLSearchParams('category=finansebi&paid=true&sort=salary&page=4'),
  );
  const url = new URL(
    companyResultsPath('/companies/tbc', filters, 2),
    'https://jobx.ge',
  );
  assert.equal(filters.category, 'ფინანსები');
  assert.equal(url.searchParams.get('category'), 'ფინანსები');
  assert.equal(url.searchParams.get('paid'), 'true');
  assert.equal(url.searchParams.get('sort'), 'salary');
  assert.equal(url.searchParams.get('page'), '2');
  const invalid = companyFilters(
    new URLSearchParams('category=unknown&sort=unknown&paid=yes'),
  );
  assert.equal(companyResultsPath('/companies/tbc', invalid), '/companies/tbc');
});

void test('company city options merge branch labels and omit departments', () => {
  assert.deepEqual(companyLocationNames('სამტრედიის ს/ც #1'), ['სამტრედია']);
  assert.deepEqual(companyLocationNames('საჩხერის ს/ც #1'), ['საჩხერე']);
  assert.deepEqual(companyLocationNames('ისნის ს/ც 2'), ['თბილისი']);
  assert.deepEqual(
    companyLocationNames('სათავო/ინფორმაციული უსაფრთხოების განყოფილება'),
    [],
  );
  assert.deepEqual(
    companyLocationNames('სათაო / ინფორმაციული უსაფრთხოების განყოფილება'),
    [],
  );
  assert.deepEqual(companyLocationNames('თბილისი, ბათუმი და ქუთაისი'), [
    'თბილისი',
    'ბათუმი',
    'ქუთაისი',
  ]);
  assert.deepEqual(companyLocationNames('რუსთავი, შარტავას #3'), ['რუსთავი']);
  assert.deepEqual(companyLocationNames('გორგია'), []);
});

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
