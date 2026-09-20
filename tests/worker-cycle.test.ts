import test from 'node:test';
import assert from 'node:assert/strict';
import { runSourceCycle } from '../worker/cycle';

function fixture({ due = true, failed = 14, stopped = false } = {}) {
  const events: string[] = [];
  const deps: Parameters<typeof runSourceCycle>[1] = {
    refresh: async (source, limit, budget) => {
      events.push('refresh');
      assert.equal(limit, 20);
      assert.equal(budget, 180_000);
      return {
        source,
        refreshed: 0,
        held: 0,
        failed,
        removed: 0,
        remaining: failed,
      };
    },
    discover: async () => {
      events.push('discover');
      return { skipped: true };
    },
    reconcile: async () => {
      events.push('reconcile');
      return { unchanged: 1 };
    },
    isDue: async () => due,
    stopped: () => stopped,
    reportRefresh: (result) => {
      assert.equal(result.failed, failed);
      events.push('refresh-reported');
    },
    reportDiscovery: () => {
      events.push('discovery-reported');
    },
    reportAutomation: () => {},
  };
  return { events, deps };
}
void test('new-only cycles discover and reconcile without invoking repairs', async () => {
  const { events, deps } = fixture();
  deps.refresh = async () => {
    throw Error('must never fetch old details');
  };
  await runSourceCycle('jobs', deps);
  await runSourceCycle('jobs', deps);
  assert.deepEqual(events, [
    'discover',
    'reconcile',
    'discovery-reported',
    'discover',
    'reconcile',
    'discovery-reported',
  ]);
});
void test('not-yet-due and stopped sources make no detail requests', async () => {
  const { events, deps } = fixture({ due: false });
  await runSourceCycle('jobs', deps);
  assert.deepEqual(events, ['discovery-reported']);
  const stopped = fixture({ stopped: true });
  await runSourceCycle('jobs', stopped.deps);
  assert.deepEqual(stopped.events, []);
});
void test('a discovery infrastructure failure stops the cycle', async () => {
  const { events, deps } = fixture();
  deps.discover = async () => {
    throw Error('database unavailable');
  };
  await assert.rejects(runSourceCycle('jobs', deps), /database unavailable/);
  assert.ok(!events.includes('refresh'));
});
