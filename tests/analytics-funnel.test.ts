import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFunnel,
  resumeLabels,
  resumeLadder,
} from '../lib/analytics-funnel';

const ladder = [
  ['opened', 'გვერდი გაიხსნა'],
  ['started', 'შევსება დაიწყო'],
  ['printed', 'PDF-ად შეინახა'],
] as const;

void test('funnel computes each count, share of opening and loss from the previous step', () => {
  const report = buildFunnel(
    [
      { value: 'opened', count: 100 },
      { value: 'started', count: 40 },
      { value: 'printed', count: 10 },
    ],
    ladder,
    resumeLabels,
  );
  assert.equal(report.opened, 100);
  assert.deepEqual(report.steps, [
    {
      name: 'opened',
      label: 'გვერდი გაიხსნა',
      count: 100,
      share: 100,
      drop: 0,
    },
    {
      name: 'started',
      label: 'შევსება დაიწყო',
      count: 40,
      share: 40,
      drop: 60,
    },
    {
      name: 'printed',
      label: 'PDF-ად შეინახა',
      count: 10,
      share: 10,
      drop: 75,
    },
  ]);
});

void test('missing steps stay in the ladder and a zero previous count has zero loss', () => {
  const { steps } = buildFunnel(
    [
      { value: 'opened', count: 3 },
      { value: 'printed', count: 1 },
    ],
    ladder,
    resumeLabels,
  );
  assert.deepEqual(steps[1], {
    name: 'started',
    label: 'შევსება დაიწყო',
    count: 0,
    share: 0,
    drop: 100,
  });
  assert.equal(steps[2].share, 33);
  assert.equal(steps[2].drop, 0);
});

void test('departures and refusals are sorted separately from the ladder with label fallback', () => {
  const report = buildFunnel(
    [
      { value: 'left_unknown', count: 2 },
      { value: 'invalid_email', count: 1 },
      { value: 'left_experience', count: 8 },
      { value: 'invalid_phone', count: 4 },
    ],
    ladder,
    resumeLabels,
  );
  assert.deepEqual(report.left, [
    { name: 'experience', label: 'გამოცდილება', count: 8 },
    { name: 'unknown', label: 'unknown', count: 2 },
  ]);
  assert.deepEqual(report.refused, [
    { name: 'phone', count: 4 },
    { name: 'email', count: 1 },
  ]);
  assert.deepEqual(
    report.steps.map(({ name }) => name),
    ladder.map(([name]) => name),
  );
  assert.ok(report.steps.every(({ count }) => count === 0));
});

void test('empty rows produce a complete zero-count funnel', () => {
  const report = buildFunnel([], resumeLadder, resumeLabels);
  assert.equal(report.opened, 0);
  assert.deepEqual(
    report.steps,
    resumeLadder.map(([name, label]) => ({
      name,
      label,
      count: 0,
      share: 0,
      drop: 0,
    })),
  );
  assert.deepEqual(report.left, []);
  assert.deepEqual(report.refused, []);
});

void test('increasing counts never produce negative loss', () => {
  const { steps } = buildFunnel(
    [
      { value: 'opened', count: 3 },
      { value: 'started', count: 2 },
      { value: 'printed', count: 3 },
    ],
    ladder,
    resumeLabels,
  );
  assert.equal(steps[1].drop, 33);
  assert.equal(steps[2].drop, 0);
});
