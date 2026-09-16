import test from 'node:test';
import assert from 'node:assert/strict';

/* Runs only against a separate test database: `RUN_DB_TESTS=1` with DATABASE_URL pointing at it.
   It truncates the analytics tables, which must never happen to real counts. */
void test(
  'events are counted, folded into daily totals without loss or double counting, and constrained',
  { skip: process.env.RUN_DB_TESTS !== '1' },
  async () => {
    const { db } = await import('../lib/server/db');
    const { analyticsSummary, normalizeEvent, recordEvent, rollupAnalytics } =
      await import('../lib/server/analytics');
    await db().query('TRUNCATE analytics_events, analytics_daily');
    for (const [kind, value] of [
      ['search', 'Მოლარე'],
      ['search', 'მოლარე '],
      ['search_empty', 'ფლებოტომისტი'],
    ] as const) {
      const event = normalizeEvent(kind, value)!;
      await recordEvent(event.kind, event.value);
    }
    await db().query(
      `INSERT INTO analytics_events(kind,value,created_at) VALUES('search','მოლარე', now() - interval '45 days')`,
    );
    const before = await analyticsSummary(90);
    assert.equal(before.searches[0].value, 'მოლარე');
    assert.equal(
      before.searches[0].count,
      3,
      'case and spacing fold into one search',
    );
    assert.equal(
      (await analyticsSummary(30)).totals.search,
      2,
      'a 45-day-old event is outside 30 days',
    );

    /* The curve keeps one point per bucket across the whole window, empty ones
       included, and adds up to the totals it is drawn beside. */
    const day = await analyticsSummary(1);
    assert.equal(day.unit, 'hour');
    assert.equal(day.activity.length, 24, 'a day is read hour by hour');
    assert.equal(
      day.activity.reduce((n, point) => n + point.search, 0),
      day.totals.search,
      'the curve and the total count the same events',
    );
    assert.equal(
      day.to.slice(0, 13),
      new Date()
        .toLocaleString('sv-SE', { timeZone: 'Asia/Tbilisi' })
        .slice(0, 13)
        .replace(' ', 'T'),
      'the last point is the hour now running in Tbilisi',
    );
    assert.equal((await analyticsSummary(7)).unit, 'day');
    assert.equal(
      (await analyticsSummary(365)).unit,
      'week',
      'a year is read week by week',
    );

    assert.equal(
      await rollupAnalytics(db()),
      1,
      'exactly the old event is folded',
    );
    const after = await analyticsSummary(90);
    assert.deepEqual(
      after.totals,
      before.totals,
      'moving an event to the daily table changes no total',
    );
    assert.equal(
      (await db().query('SELECT count(*)::int n FROM analytics_events')).rows[0]
        .n,
      3,
    );

    await assert.rejects(
      db().query(
        `INSERT INTO analytics_events(kind,value) VALUES('ip','1.2.3.4')`,
      ),
      /check constraint/,
      'the database itself refuses a kind outside the four',
    );
    await db().query('TRUNCATE analytics_events, analytics_daily');
    await db().end();
  },
);
