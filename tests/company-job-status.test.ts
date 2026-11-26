import test from 'node:test';
import assert from 'node:assert/strict';
import { isExpired, isClosed, inGroup, jobGroupOf, jobStatus } from '../lib/company-job-status';

const today = '2026-11-26';
const job = (status = 'published', deadline = '2026-11-25', needsReview = false) => ({ status, needsReview, form: { deadline } });

for (const deadline of ['2026-11-25', today, '2026-11-27', '']) {
  test(`published deadline ${deadline || 'empty'} uses Tbilisi calendar date`, () => {
    const value = job('published', deadline);
    const expired = deadline === '2026-11-25';
    assert.equal(isExpired(value, today), expired);
    assert.equal(isClosed(value, today), expired);
    assert.equal(inGroup(value, 'active', today), !expired);
    assert.equal(inGroup(value, 'closed', today), expired);
    assert.equal(jobGroupOf(value, today), expired ? 'closed' : 'active');
    assert.deepEqual(jobStatus(value, today), expired ? { label: 'ვადა გასულია', tone: 'warning' } : { label: 'აქტიური', tone: 'success' });
    assert.equal(value.status, 'published');
  });
}
for (const [status, group, label, tone] of [
  ['pending', 'review', 'განხილვაშია', 'warning'],
  ['rejected', 'closed', 'უარყოფილი', 'danger'],
  ['archived', 'closed', 'დახურული', 'neutral'],
  ['merged', 'closed', 'გაერთიანებული', 'neutral'],
  ['unknown', null, 'unknown', 'neutral'],
] as const) {
  test(`${status} keeps its status even with a past deadline`, () => {
    const value = job(status);
    assert.equal(isExpired(value, today), false);
    assert.equal(jobGroupOf(value, today), group);
    assert.equal(inGroup(value, 'all', today), true);
    assert.equal(inGroup(value, 'active', today), false);
    assert.deepEqual(jobStatus(value, today), { label, tone });
  });
}
test('group counts exclude expired published jobs from active and include them in closed', () => {
  const jobs = [job(), job('published', today), job('published', '2026-11-27'), job('published', ''), job('pending'), job('archived'), job('rejected'), job('merged')];
  const count = (group: 'all' | 'active' | 'review' | 'closed') => jobs.filter(j => inGroup(j, group, today)).length;
  assert.deepEqual(['all', 'active', 'review', 'closed'].map(g => count(g as Parameters<typeof count>[0])), [8, 3, 1, 4]);
});
test('published edits awaiting review remain discoverable in review', () => {
  const value = job('published', '2026-11-25', true);
  assert.equal(inGroup(value, 'review', today), true);
  assert.equal(inGroup(value, 'active', today), false);
  assert.equal(jobGroupOf(value, today), 'closed');
});
