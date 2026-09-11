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
void test('repeated repair failures cannot starve due discovery on successive worker invocations', async () => {
  const { events, deps } = fixture();
  await runSourceCycle('jobs', deps);
  await runSourceCycle('jobs', deps);
  assert.equal(events.filter((e) => e === 'discover').length, 2);
  assert.deepEqual(events.slice(0, 6), [
    'refresh',
    'refresh-reported',
    'reconcile',
    'discover',
    'reconcile',
    'discovery-reported',
  ]);
});
void test('paused or not-yet-due discovery stays paused while requested repairs proceed', async () => {
  const { events, deps } = fixture({ due: false });
  await runSourceCycle('jobs', deps);
  assert.ok(events.includes('refresh'));
  assert.ok(!events.includes('discover'));
});
void test('shutdown and infrastructure failures never start another discovery batch', async () => {
  const { events, deps } = fixture({ stopped: true });
  await runSourceCycle('jobs', deps);
  assert.ok(!events.includes('discover'));
  const broken = fixture();
  broken.deps.refresh = async () => {
    throw Error('database unavailable');
  };
  await assert.rejects(
    runSourceCycle('jobs', broken.deps),
    /database unavailable/,
  );
  assert.ok(!broken.events.includes('discover'));
});
