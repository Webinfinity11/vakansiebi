import test from 'node:test';
import assert from 'node:assert/strict';
import { placementDeadline } from '../lib/placement-deadline';

test('paid deadline retains a later date and extends earlier, empty and invalid dates', () => {
  const activated = new Date('2026-11-26T12:00:00Z');
  assert.equal(placementDeadline('2027-01-25', activated, 30), '2027-01-25');
  for (const value of [undefined, '', 'invalid', '2026-02-30', '2026-13-01', '2026-12-01', '2026-11-01'])
    assert.equal(placementDeadline(value, activated, 30), '2026-12-26');
  assert.equal(placementDeadline('2026-12-26', activated, 30), '2026-12-26');
});

test('paid deadline uses the Tbilisi day boundary and handles leap years', () => {
  assert.equal(placementDeadline(undefined, new Date('2026-11-26T19:59:59Z'), 30), '2026-12-26');
  assert.equal(placementDeadline(undefined, new Date('2026-11-26T20:00:00Z'), 30), '2026-12-27');
  assert.equal(placementDeadline(undefined, new Date('2028-02-28T20:00:00Z'), 1), '2028-03-01');
  assert.equal(placementDeadline(undefined, new Date('2026-12-31T20:00:00Z'), 14), '2027-01-15');
});

test('invalid activation inputs are rejected', () => {
  assert.throws(() => placementDeadline(undefined, new Date('invalid'), 30), RangeError);
  for (const days of [-1, 1.5, NaN, Infinity])
    assert.throws(() => placementDeadline(undefined, new Date(), days), RangeError);
});
