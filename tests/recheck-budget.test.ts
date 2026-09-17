import test from 'node:test';
import assert from 'node:assert/strict';
import { recheckBudget } from '../worker/recheck-budget';

void test('economy spreads routine verification instead of filling an empty new-item queue', () => {
  assert.equal(recheckBudget('economical', 200, 100, 180, 0), 20);
  assert.equal(recheckBudget('economical', 200, 2400, 180, 0), 100);
  assert.equal(recheckBudget('economical', 200, 1752, 180, 0), 73);
});

void test('slower schedules and urgent stale records receive enough verification capacity', () => {
  assert.equal(recheckBudget('economical', 200, 2400, 360, 0), 200);
  assert.equal(recheckBudget('economical', 200, 100, 180, 80), 80);
  assert.equal(recheckBudget('economical', 200, 100, 180, 500), 200);
  assert.equal(recheckBudget('full', 200, 100, 180, 0), 200);
  assert.equal(recheckBudget(undefined, 200, 100, 180, 0), 200);
});
