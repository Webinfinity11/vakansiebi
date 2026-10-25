import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

/* Runs only against a separate test database: `RUN_DB_TESTS=1` with DATABASE_URL pointing at it.
   It truncates the analytics tables, which must never happen to real counts. */
void test(
  'events are counted, folded into daily totals without loss or double counting, and constrained',
  { skip: process.env.RUN_DB_TESTS !== '1' },
  async () => {
    const url = new URL(process.env.DATABASE_URL!);
    assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
    assert.equal(url.pathname, '/ertad_test');
    const { db } = await import('../lib/server/db');
    const { analyticsSummary, normalizeEvent, recordEvent, rollupAnalytics } =
      await import('../lib/server/analytics');
    await db().query('TRUNCATE analytics_events, analytics_daily');
    for (const [kind, value] of [
      ['search', 'Მოლარე'],
      ['search', 'მოლარე '],
      ['search', 'ფლებოტომისტი'],
      ['search_empty', 'ფლებოტომისტი'],
    ] as const) {
      const event = normalizeEvent(kind, value)!;
      await recordEvent(event.kind, event.value);
    }
    await db().query(
      `INSERT INTO analytics_events(kind,value,created_at) VALUES('search','მოლარე', now() - interval '45 days')`,
    );
    const before = await analyticsSummary(90);
    assert.deepEqual(
      before.searchPerformance.find((r) => r.value === 'ფლებოტომისტი'),
      { value: 'ფლებოტომისტი', searches: 1, empty: 1 },
    );
    assert.equal(before.searches[0].value, 'მოლარე');
    assert.equal(
      before.searches[0].count,
      3,
      'case and spacing fold into one search',
    );
    assert.equal(
      (await analyticsSummary(30)).totals.search,
      3,
      'a 45-day-old event is outside 30 days',
    );

    /* The curve keeps one point per bucket across the whole window, empty ones
       included, and adds up to the totals it is drawn beside. */
    const day = await analyticsSummary(1);
    assert.equal(day.unit, 'hour');
    assert.equal(
      day.activity.length,
      Number(
        new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Asia/Tbilisi',
          hour: '2-digit',
          hourCycle: 'h23',
        }).format(new Date()),
      ) + 1,
      'one day includes today from Tbilisi midnight through the current hour',
    );
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
    for (const days of [7, 30, 90]) {
      const summary = await analyticsSummary(days);
      assert.equal(
        summary.activity.length,
        days,
        `${days} calendar days include exactly ${days} buckets`,
      );
      assert.equal(summary.from.slice(10), 'T00:00');
      assert.equal(summary.to.slice(0, 10), day.to.slice(0, 10));
    }
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
      4,
    );

    // Calendar boundaries remain exact before and after daily aggregation.
    await db().query(`WITH edge AS (
      SELECT date_trunc('day',now() AT TIME ZONE 'Asia/Tbilisi') AT TIME ZONE 'Asia/Tbilisi' midnight
    ) INSERT INTO analytics_events(kind,value,created_at)
    SELECT 'search','edge-' || days || '-' || label,
      midnight - (days - 1) * interval '1 day' + delta
    FROM edge CROSS JOIN (VALUES(7),(30),(90)) periods(days)
    CROSS JOIN (VALUES('before',interval '-1 microsecond'),('start',interval '0 days')) boundaries(label,delta)`);
    const boundaryCounts = async () => {
      for (const days of [7, 30, 90]) {
        const summary = await analyticsSummary(days, 100);
        assert.ok(
          summary.searches.some((row) => row.value === `edge-${days}-start`),
        );
        assert.ok(
          !summary.searches.some((row) => row.value === `edge-${days}-before`),
        );
        assert.equal(
          summary.activity.reduce((sum, row) => sum + row.search, 0),
          summary.totals.search,
        );
      }
    };
    await boundaryCounts();
    await rollupAnalytics(db());
    await boundaryCounts();

    // The chart and the totals use identical ranges for every grain.
    await db().query(`INSERT INTO analytics_events(kind,value,created_at) VALUES
      ('search','boundary',now()-interval '24 hours'+interval '1 minute'),
      ('search','week boundary',now()-interval '7 days'+interval '1 minute')`);
    for (const days of [1, 7, 90, 365]) {
      const summary = await analyticsSummary(days);
      assert.equal(
        summary.activity.reduce((n, p) => n + p.search, 0),
        summary.totals.search,
        `curve matches total for ${days} days`,
      );
    }
    // Calendar-day filters must split at Tbilisi midnight, even on a UTC server.
    await db()
      .query(`WITH edge AS (SELECT date_trunc('day',now() AT TIME ZONE 'Asia/Tbilisi') AT TIME ZONE 'Asia/Tbilisi' midnight)
      INSERT INTO analytics_events(kind,value,created_at)
      SELECT 'search',value,midnight+delta FROM edge CROSS JOIN (VALUES
        ('calendar-before',interval '-1 day' - interval '1 millisecond'),
        ('calendar-yesterday-start',interval '-1 day'),
        ('calendar-yesterday-end',interval '-1 millisecond'),
        ('calendar-today',interval '0 days'),
        ('calendar-future',interval '1 day')
      ) fixture(value,delta)`);
    await db()
      .query(`WITH edge AS (SELECT date_trunc('day',now() AT TIME ZONE 'Asia/Tbilisi') AT TIME ZONE 'Asia/Tbilisi' midnight)
      INSERT INTO analytics_events(kind,value,created_at)
      SELECT kind,value,midnight+delta FROM edge CROSS JOIN (VALUES
        ('view','11111111-1111-4111-8111-111111111111'),
        ('outbound','11111111-1111-4111-8111-111111111111'),
        ('resume','stored'),('post','opened'),('action','preview'),('filter','city')
      ) kinds(kind,value) CROSS JOIN (VALUES(interval '-1 day'),(interval '0 days'),(interval '1 day')) days(delta)`);
    const today = await analyticsSummary('today');
    const yesterday = await analyticsSummary('yesterday');
    assert.equal(today.period, 'today');
    assert.equal(today.from.slice(10), 'T00:00');
    assert.deepEqual(
      today.searches
        .filter((r) => r.value.startsWith('calendar-'))
        .map((r) => r.value),
      ['calendar-today'],
    );
    assert.equal(yesterday.period, 'yesterday');
    assert.equal(yesterday.from.slice(10), 'T00:00');
    assert.equal(
      yesterday.to,
      today.from,
      'yesterday ends exactly where today starts',
    );
    assert.equal(
      yesterday.activity.length,
      24,
      'a completed day has exactly 24 hourly buckets',
    );
    assert.equal(yesterday.activity.at(-1)?.bucket.slice(10), 'T23:00');
    assert.deepEqual(
      new Set(
        yesterday.searches
          .filter((r) => r.value.startsWith('calendar-'))
          .map((r) => r.value),
      ),
      new Set(['calendar-yesterday-start', 'calendar-yesterday-end']),
    );
    for (const summary of [today, yesterday]) {
      for (const kind of [
        'view',
        'outbound',
        'resume',
        'post',
        'action',
        'filter',
      ] as const) {
        assert.equal(
          summary.totals[kind],
          1,
          `${summary.period}: ${kind} excludes the adjacent day and future events`,
        );
      }
      assert.equal(
        summary.activity.reduce((n, p) => n + p.search, 0),
        summary.totals.search,
        'calendar-day chart and all totals use the same two edges',
      );
      assert.equal(
        summary.searches.some((r) => r.value === 'calendar-future'),
        false,
      );
    }
    const submittedJobs: string[] = [];
    try {
      for (const [isTest, delta] of [
        [false, '0 days'],
        [true, '0 days'],
        [false, '1 day'],
        [false, '-1 day'],
      ] as const) {
        const id = randomUUID();
        await db().query(
          `INSERT INTO jobs(id,draft,fingerprint) VALUES($1::uuid,'{}',$1::text)`,
          [id],
        );
        submittedJobs.push(id);
        await db().query(
          `INSERT INTO job_submissions(request_id,job_id,client_hash,payload_hash,is_test,created_at)
          VALUES($1,$1,'analytics-test','analytics-test',$2,
          (date_trunc('day',now() AT TIME ZONE 'Asia/Tbilisi') AT TIME ZONE 'Asia/Tbilisi') + $3::interval)`,
          [id, isTest, delta],
        );
      }
      assert.equal(
        (await analyticsSummary('today')).receivedPosts,
        today.receivedPosts! + 1,
        'received submissions exclude test records, future records and the adjacent day',
      );
      assert.equal(
        (await analyticsSummary('yesterday')).receivedPosts,
        yesterday.receivedPosts! + 1,
      );
    } finally {
      await db().query(
        'DELETE FROM job_submissions WHERE job_id=ANY($1::uuid[])',
        [submittedJobs],
      );
      await db().query('DELETE FROM jobs WHERE id=ANY($1::uuid[])', [
        submittedJobs,
      ]);
    }
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
