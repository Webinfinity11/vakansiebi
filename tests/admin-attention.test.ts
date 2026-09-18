import test from 'node:test';
import assert from 'node:assert/strict';
import { attentionList, whenText } from '../lib/admin-attention';
import type { Source } from '../lib/types';

const now = Date.parse('2026-09-18T09:00:00Z');
const ago = (h: number) => new Date(now - h * 3600000).toISOString();
const source = (over: Partial<Source> & { name: string }): Source =>
  ({
    id: over.name.split('.')[0],
    enabled: true,
    auto_enabled: true,
    interval_minutes: 180,
    detail_interval_hours: 24,
    last_started_at: ago(1),
    last_success_at: ago(1),
    next_run_at: ago(-2),
    last_error: null,
    consecutive_failures: 0,
    requested_at: null,
    imported: 0,
    queued: 0,
    ...over,
  }) as Source;

void test('a source that has stopped is named, with the reason it stopped', () => {
  const [first] = attentionList(
    [source({ name: 'jobs.ge', last_success_at: ago(30) })],
    now,
  );
  assert.equal(first.severity, 'stopped');
  assert.match(first.detail, /30 საათის წინ/);
  assert.equal(first.action?.kind, 'run');
});
void test('the two government sources are told to be collected here, not run there', () => {
  const [first] = attentionList(
    [source({ name: 'worknet.moh.gov.ge', last_success_at: ago(80) })],
    now,
  );
  assert.equal(first.severity, 'stopped');
  assert.match(first.advice, /worker:gov/);
  // There is no button for it: the fix is on this machine, not on the server.
  assert.equal(first.action, undefined);
});
void test('a run that never finished, and a request nobody took, are both jams', () => {
  const running = attentionList(
    [
      source({
        name: 'hr.ge',
        latest_run: { status: 'running', started_at: ago(2) },
      } as Partial<Source> & { name: string }),
    ],
    now,
  );
  assert.equal(running[0].severity, 'stuck');
  const unclaimed = attentionList(
    [source({ name: 'hr.ge', requested_at: ago(5) })],
    now,
  );
  assert.equal(unclaimed[0].severity, 'stuck');
});
void test('repeated failures ask for rest rather than another attempt', () => {
  const [first] = attentionList(
    [source({ name: 'ss.ge', consecutive_failures: 4, last_error: 'timeout' })],
    now,
  );
  assert.equal(first.severity, 'tired');
  assert.equal(first.action?.kind, 'rest');
  assert.match(first.advice, /ინტერვალი|პარტიის/);
});
void test('a healthy source says nothing, and the worst news comes first', () => {
  assert.deepEqual(attentionList([source({ name: 'jobs.ge' })], now), []);
  const list = attentionList(
    [
      source({ name: 'a.ge', quality_held: 3 } as Partial<Source> & {
        name: string;
      }),
      source({ name: 'b.ge', consecutive_failures: 5 }),
      source({ name: 'c.ge', last_success_at: ago(40) }),
    ],
    now,
  );
  assert.deepEqual(
    list.map((item) => item.severity),
    ['stopped', 'tired', 'note'],
  );
});
void test('time is said the way it would be spoken', () => {
  assert.equal(whenText(0.5), '30 წუთის წინ');
  assert.equal(whenText(6), '6 საათის წინ');
  assert.equal(whenText(72), '3 დღის წინ');
  assert.equal(whenText(Infinity), 'არასდროს');
});
