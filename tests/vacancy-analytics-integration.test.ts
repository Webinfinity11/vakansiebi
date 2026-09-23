import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { vacancyEventKinds } from '../lib/vacancy-analytics';

void test(
  'batch vacancy statistics retain old IDs across rollup and respect the seven-day boundary',
  { skip: process.env.RUN_DB_TESTS !== '1' },
  async () => {
    const url = new URL(process.env.DATABASE_URL!);
    assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
    assert.equal(url.pathname, '/ertad_test');
    const { db } = await import('../lib/server/db');
    const { rollupAnalytics } = await import('../lib/server/analytics');
    const { vacancyAnalytics } =
      await import('../lib/server/vacancy-analytics');
    const first = randomUUID(),
      second = randomUUID(),
      empty = randomUUID();
    const ids = [first, second, empty];
    try {
      for (const kind of vacancyEventKinds) {
        await db().query(
          `INSERT INTO analytics_events(kind,value,created_at)
          SELECT $1,$2,now() - age FROM unnest(ARRAY[
            interval '1 day',interval '7 days' - interval '1 minute',
            interval '7 days' + interval '1 minute',interval '45 days']) age`,
          [kind, first],
        );
      }
      await db().query(
        `INSERT INTO analytics_events(kind,value) VALUES('view',$1)`,
        [second],
      );
      await db().query(
        `INSERT INTO analytics_events(kind,value) VALUES('search',$1)`,
        [first],
      );
      const before = await vacancyAnalytics(ids);
      for (const kind of vacancyEventKinds) {
        assert.equal(before[first].total[kind], 4);
        assert.equal(before[first].last7[kind], 2);
        assert.equal(before[empty].total[kind], 0);
        assert.equal(before[empty].last7[kind], 0);
      }
      assert.equal(before[second].total.view, 1);
      assert.equal(before[second].total.cv, 0);
      await rollupAnalytics(db());
      assert.deepEqual(await vacancyAnalytics(ids), before);
      assert.deepEqual(await vacancyAnalytics([]), {});
    } finally {
      await db().query(
        'DELETE FROM analytics_events WHERE value = ANY($1::text[])',
        [ids],
      );
      await db().query(
        'DELETE FROM analytics_daily WHERE value = ANY($1::text[])',
        [ids],
      );
      await db().end();
    }
  },
);
