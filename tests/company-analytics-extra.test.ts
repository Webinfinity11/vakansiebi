import assert from 'node:assert/strict';
import test from 'node:test';
import { candidateSources, candidateHireTime, type AnalyticsCandidate } from '../lib/company-analytics-extra';

const period = { first: '2026-10-18', last: '2026-11-16' };
const candidate = (overrides: Partial<AnalyticsCandidate> = {}): AnalyticsCandidate => ({
  source: 'swipe', jobId: 'job-a', appliedAt: '2026-11-01T12:00:00Z', stage: 'new', ...overrides,
});

test('empty data has zero sources and no measurable hire time', () => {
  assert.deepEqual(candidateSources([], period).map(({ count, share }) => [count, share]), [[0, 0], [0, 0], [0, 0]]);
  assert.deepEqual(candidateHireTime([], period), { averageDays: null, measuredHires: 0, hiredCount: 0 });
});

test('one hired candidate without a hire timestamp cannot provide a duration', () => {
  assert.deepEqual(candidateHireTime([candidate({ stage: 'hired' })], period), {
    averageDays: null, measuredHires: 0, hiredCount: 1,
  });
});

test('application sources are combined, uploads and CV box remain distinct', () => {
  const result = candidateSources(['swipe', 'resume', 'upload', 'cv_box'].map((source) =>
    candidate({ source: source as AnalyticsCandidate['source'] })), period);
  assert.deepEqual(result, [
    { source: 'applied', count: 2, share: 0.5 },
    { source: 'upload', count: 1, share: 0.25 },
    { source: 'cv_box', count: 1, share: 0.25 },
  ]);
});

test('both calculations respect inclusive UTC period boundaries and vacancy scope', () => {
  const entries = [
    '2026-10-17T23:59:59Z', '2026-10-18T00:00:00Z',
    '2026-11-16T23:59:59Z', '2026-11-17T00:00:00Z', 'invalid',
  ].map((appliedAt) => candidate({ appliedAt, stage: 'hired' }));
  entries.push(candidate({ jobId: 'job-b', stage: 'hired' }));
  const scope = { ...period, jobId: 'job-a' };
  assert.equal(candidateSources(entries, scope)[0].count, 2);
  assert.equal(candidateHireTime(entries, scope).hiredCount, 2);
  assert.equal(candidateHireTime(entries, scope).averageDays, null);
});

test('average uses recorded nonnegative durations, excludes legacy and other stages', () => {
  const result = candidateHireTime([
    candidate({ stage: 'hired', hiredAt: '2026-11-03T12:00:00Z' }),
    candidate({ source: 'upload', stage: 'hired', hiredAt: '2026-11-05T12:00:00Z' }),
    candidate({ stage: 'hired' }),
    candidate({ stage: 'review', hiredAt: '2026-11-10T12:00:00Z' }),
    candidate({ stage: 'hired', hiredAt: 'invalid' }),
    candidate({ stage: 'hired', hiredAt: '2026-10-31T12:00:00Z' }),
    candidate({ stage: 'hired', jobId: 'other', hiredAt: '2026-11-10T12:00:00Z' }),
  ], { ...period, jobId: 'job-a' });
  assert.deepEqual(result, { averageDays: 3, measuredHires: 2, hiredCount: 5 });
});

test('same day hire is a measured zero, not missing data', () => {
  assert.equal(candidateHireTime([candidate({ stage: 'hired', hiredAt: '2026-11-01T12:00:00Z' })], period).averageDays, 0);
});
