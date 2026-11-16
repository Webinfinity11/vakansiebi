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
