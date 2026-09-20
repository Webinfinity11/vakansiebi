import test from 'node:test';
import assert from 'node:assert/strict';
import { importDateReason } from '../worker/new-only';

void test('rolling three calendar days includes today and crosses month/year boundaries', () => {
  for (const day of ['2026-09-20', '2026-09-19', '2026-09-18'])
    assert.equal(importDateReason(day, '2026-09-20'), null);
  assert.equal(importDateReason('2026-09-17', '2026-09-20'), 'outside_window');
  assert.equal(importDateReason('2026-09-21', '2026-09-20'), 'outside_window');
  assert.equal(importDateReason('2026-12-31', '2027-01-02'), null);
  assert.equal(importDateReason('2026-09-30', '2026-10-02'), null);
});
void test('unknown and impossible publication dates never become new discoveries', () => {
  for (const date of ['', undefined, '2026-02-30', 'today', '2026-9-2'])
    assert.equal(importDateReason(date, '2026-09-20'), 'undated');
});
