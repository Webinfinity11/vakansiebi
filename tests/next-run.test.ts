import test from 'node:test';
import assert from 'node:assert/strict';
import { nextRunAt } from '../worker/next-run';
void test('a completed cron batch remains eligible for the next three-hour slot', () => {
  assert.equal(
    nextRunAt(180, Date.parse('2026-09-14T12:25:00Z'), 180).toISOString(),
    '2026-09-14T15:17:00.000Z',
  );
  assert.equal(
    nextRunAt(180, Date.parse('2026-09-14T15:17:00Z'), 180).toISOString(),
    '2026-09-14T18:17:00.000Z',
  );
  assert.equal(
    nextRunAt(180, Date.parse('2026-09-14T23:59:00Z'), 180).toISOString(),
    '2026-09-15T00:17:00.000Z',
  );
});
void test('local workers wait a full interval while longer cron intervals keep the slot', () => {
  const now = Date.parse('2026-09-14T12:25:00Z');
  assert.equal(
    nextRunAt(180, now, 0).toISOString(),
    '2026-09-14T15:25:00.000Z',
  );
  assert.equal(
    nextRunAt(360, now, 180).toISOString(),
    '2026-09-14T18:17:00.000Z',
  );
  assert.equal(
    nextRunAt(240, now, 180).toISOString(),
    '2026-09-14T16:25:00.000Z',
  );
});

void test('a quiet source waits longer, up to twelve hours, and stays on the slot', async () => {
  const { quietIntervalMinutes, nextRunAt } = await import('../worker/next-run');
  // One empty check is a quiet hour, not a quiet board.
  assert.equal(quietIntervalMinutes(180, 0), 180);
  assert.equal(quietIntervalMinutes(180, 1), 180);
  assert.equal(quietIntervalMinutes(180, 2), 360);
  assert.equal(quietIntervalMinutes(180, 3), 720);
  assert.equal(quietIntervalMinutes(180, 9), 720);
  // A source an admin already set to a day is never checked more often.
  assert.equal(quietIntervalMinutes(1440, 3), 1440);
  const now = Date.UTC(2026, 8, 25, 9, 25);
  assert.equal(
    nextRunAt(quietIntervalMinutes(180, 2), now, 180).toISOString(),
    '2026-09-25T15:17:00.000Z',
  );
});
