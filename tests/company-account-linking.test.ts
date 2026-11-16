import test from 'node:test';
import assert from 'node:assert/strict';
import { companyNameProbe } from '../lib/server/company-accounts';
import { companyKey } from '../lib/company-key';

void test('company name probe picks the longest letter run for the ILIKE pre-filter', () => {
  assert.equal(companyNameProbe('შპს „თიბისი ბანკი“'), 'თიბისი');
  assert.equal(companyNameProbe('Bank of Georgia'), 'Georgia');
  assert.equal(companyNameProbe('  --  '), '');
  // Every spelling that shares a company key also contains the probe, so the
  // pre-filter never hides a vacancy the exact comparison would accept.
  for (const [a, b] of [
    ['შპს „თიბისი ბანკი“', 'შპს თიბისი-ბანკი'],
    ['Bank of Georgia', 'BANK OF GEORGIA'],
  ]) {
    assert.equal(companyKey(a), companyKey(b));
    assert.ok(b.toLowerCase().includes(companyNameProbe(a).toLowerCase()));
  }
});
