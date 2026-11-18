import test from 'node:test';
import assert from 'node:assert/strict';
import { companyTabs, initialCompanyTab } from '../lib/company-portal-navigation';

test('owner deep links accept every existing portal tab', () => {
  for (const tab of companyTabs) {
    assert.equal(initialCompanyTab(new URLSearchParams(`?tab=${tab}`).get('tab'), 'owner'), tab);
  }
});
test('viewer and recruiter deep links cannot open owner-only tabs', () => {
  for (const role of ['viewer', 'recruiter', undefined] as const) {
    for (const tab of companyTabs) {
      assert.equal(initialCompanyTab(tab, role), ['billing', 'team'].includes(tab) ? 'jobs' : tab);
    }
  }
});
test('unknown and malformed deep links fall back to jobs', () => {
  for (const value of [null, '', 'viewer', 'Profile', '/company', 'javascript:alert(1)', 'profile ']) {
    assert.equal(initialCompanyTab(value, 'owner'), 'jobs');
  }
});
test('the address keeps the tab, the open candidate and the candidates filter', async () => {
  const { companyHref, readCompanyLocation } = await import('../lib/company-portal-navigation');
  const cases = [
    { tab: 'jobs', entry: null },
    { tab: 'talent', entry: 'base:r:7351bcc1-3e02-49f3-8e87-a344b3b92f68' },
    { tab: 'candidates', entry: 'swipe:42', job: 'a1b2', stage: 'interview' },
    { tab: 'profile', entry: null },
  ] as const;
  for (const l of cases) {
    const href = companyHref(l);
    assert.deepEqual(readCompanyLocation(href.split('?')[1] ?? '', 'owner'), l, href);
  }
  assert.equal(companyHref({ tab: 'jobs', entry: null }), '/company');
  // A candidate only belongs to the tabs that show one; junk never reaches the app.
  assert.equal(readCompanyLocation('?tab=profile&c=swipe:1').entry, null);
  assert.equal(readCompanyLocation('?tab=talent&c=<script>').entry, null);
  assert.equal(readCompanyLocation('?tab=candidates&c=base:r:x&job=../../x').job, undefined);
});
