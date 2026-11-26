import test from 'node:test';
import assert from 'node:assert/strict';
import { companyKey } from '../lib/company-key';
import { companyPublicPath } from '../lib/server/company-public-path';
import type { EmployerPage } from '../lib/server/employers';

const page: EmployerPage = {
  slug: 'canonical-კომპანია', name: 'Canonical company', names: ['Canonical company', 'შპს კომპანია'],
  jobIds: ['published-job'], logoUrl: '', cities: [],
  example: { title: '', category: '', city: '' },
};

test('public link uses the directory slug and matches a merged profile name', async () => {
  let checked: EmployerPage | undefined;
  const path = await companyPublicPath(companyKey('შპს კომპანია'), [page], async (employer) => {
    checked = employer;
    return false;
  });
  assert.equal(checked, page);
  assert.equal(path, '/companies/' + encodeURIComponent(page.slug));
});

test('missing, suppressed, empty and ambiguous profile identities have no public link', async () => {
  assert.equal(await companyPublicPath(companyKey('Other'), [page], async () => false), null);
  assert.equal(await companyPublicPath(companyKey(page.name), [], async () => false), null);
  assert.equal(await companyPublicPath(companyKey(page.name), [page], async () => true), null);
  assert.equal(await companyPublicPath('', [page], async () => false), null);
  assert.equal(await companyPublicPath(companyKey(page.name), [page, { ...page, slug: 'other' }], async () => false), null);
});


test('a cold directory omits publicPath without claiming the page is absent', async () => {
  const publicPath = await companyPublicPath(companyKey(page.name), null, async () => {
    assert.fail('suppression must not be queried without a directory');
  });
  assert.equal(publicPath, undefined);
  assert.equal(JSON.stringify({ publicPath }), '{}');
});
