import test from 'node:test';
import assert from 'node:assert/strict';
import { placementIsReady } from '../app/admin/submission-payment';
import type { AdminJob } from '../lib/types';

const job = (invoice: AdminJob['invoice'], tier: 'vip' | 'premium' = 'premium', expires: string | null = '2026-12-26T10:00:00Z') =>
  ({ invoice, placement_tier: tier, placement_expires_at: expires }) as AdminJob;
const inv = (status: string, renewal: string | null = null, placement_tier: 'vip' | 'premium' = 'premium') =>
  ({ status, renewal_for_expires_at: renewal, placement_tier }) as unknown as AdminJob['invoice'];

void test('an unpaid renewal does not block publishing the running placement', () => {
  assert.equal(placementIsReady(job(inv('pending', '2026-12-26T10:00:00Z')), 'premium'), true);
  assert.equal(placementIsReady(job(inv('cancelled', '2026-12-26T10:00:00Z')), 'premium'), true);
  // ...but only for the same tier that is running.
  assert.equal(placementIsReady(job(inv('pending', '2026-12-26T10:00:00Z')), 'vip'), false);
  // An ordinary unpaid invoice still blocks a paid placement.
  assert.equal(placementIsReady(job(inv('pending'), 'premium', null), 'premium'), false);
  assert.equal(placementIsReady(job(inv('paid')), 'premium'), true);
  assert.equal(placementIsReady(job(null), 'standard'), true);
});
