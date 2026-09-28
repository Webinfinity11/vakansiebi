import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRequire } from 'node:module';
import { employerJobCount } from '../lib/employer-job-count';
import { companyOverview } from '../lib/company-overview';

void test('company counts exclude invisible records and count repeated groups once', () => {
  const visible = new Map([
    ['a', 'cashier'],
    ['b', 'cashier'],
    ['c', 'manager'],
  ]);
  assert.equal(
    employerJobCount(['a', 'b', 'c', 'expired', 'hidden'], visible),
    2,
  );
  assert.equal(employerJobCount(['b'], visible), 1);
  assert.equal(employerJobCount(['expired'], visible), 0);
});

void test('company overview uses supplied facts and exposes longer descriptions separately', () => {
  assert.equal(companyOverview('  '), null);
  assert.deepEqual(companyOverview('Verified description.'), {
    summary: 'Verified description.',
    full: null,
  });
  const text = 'First paragraph.\n\nAdditional details.';
  assert.deepEqual(companyOverview(text), {
    summary: 'First paragraph.',
    full: text,
  });
  assert.ok(companyOverview('word '.repeat(100))!.summary.length <= 320);
});

void test('directory retains every company link while limiting initial external logos', async () => {
  // Match Next's CJS interop for next/image in this standalone render.
  const require = createRequire(import.meta.url);
  const {
    CompaniesDirectory,
  } = require('../app/companies/companies-directory.tsx');
  const companies = Array.from({ length: 80 }, (_, i) => ({
    slug: `company-${i}`,
    name: `Company ${i}`,
    jobs: 2,
    cities: ['თბილისი'],
    logoUrl: `https://example.com/logo-${i}.png`,
  }));
  const html = renderToStaticMarkup(
    createElement(
      CompaniesDirectory,
      { companies },
      createElement('h1', null, 'კომპანიები'),
    ),
  );
  for (const company of companies)
    assert.ok(html.includes(`href="/companies/${company.slug}"`));
  assert.equal(
    (html.match(/src="https:\/\/example.com\/logo-/g) || []).length,
    18,
  );
  assert.ok(html.includes('160'));
});
