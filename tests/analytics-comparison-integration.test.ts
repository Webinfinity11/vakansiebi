import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { Client, Pool } from 'pg';
import { db } from '../lib/server/db';
import { analyticsComparison } from '../lib/server/analytics-comparison';
import { rollupAnalytics } from '../lib/server/analytics';
import { comparisonChange } from '../lib/analytics-comparison';

void test('comparison never divides by zero or invents a growth percentage', () => {
  assert.equal(comparisonChange(5, 0), '+5');
  assert.equal(comparisonChange(0, 0), 'უცვლელია');
  assert.equal(comparisonChange(10, 5), '+100%');
  assert.equal(comparisonChange(0, 5), '−100%');
});

void test(
  'equal periods exclude partial rolled days, use sent dates and exclude test submissions',
  { skip: process.env.RUN_DB_TESTS !== '1' },
  async (t) => {
    const url = new URL(process.env.DATABASE_URL!);
    assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
    assert.equal(url.pathname, '/ertad_test');
    const schema = 'comparison_' + randomUUID().replaceAll('-', '');
    const admin = new Client({ connectionString: url.href });
    const pool = new Pool({
      connectionString: url.href,
      options: `-c search_path=${schema},public`,
    });
    const globals = globalThis as unknown as { ertadPool?: Pool };
    const previous = globals.ertadPool;
    await admin.connect();
    t.after(async () => {
      globals.ertadPool = previous;
      await pool.end();
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin.end();
    });
    await admin.query(`CREATE SCHEMA ${schema}`);
    await admin.query(`SET search_path=${schema},public`);
    for (const file of readdirSync('db/migrations')
      .filter((f) => f.endsWith('.sql'))
      .sort())
      await admin.query(readFileSync('db/migrations/' + file, 'utf8'));
    globals.ertadPool = pool;
    for (const [kind, date] of [
      ['search', '2026-09-01T09:00'],
      ['search', '2026-10-12T00:00'],
      ['search', '2026-10-17T23:59'],
      ['search', '2026-10-18T00:00'],
      ['search', '2026-10-19T08:00'],
      ['search', '2026-10-24T09:00'],
      ['search', '2026-10-24T23:59'],
      ['search', '2026-10-25T10:00'],
      ['search', '2026-10-25T13:00'],
      ['view', '2026-10-20T08:00'],
      ['outbound', '2026-10-13T08:00'],
    ])
      await db().query(
        'INSERT INTO analytics_events(kind,value,created_at) VALUES($1,$2,$3)',
        [
          kind,
          kind === 'search' ? 'comparison' : randomUUID(),
          date + ':00+04:00',
        ],
      );
    for (const [date, isTest, status] of [
      ['2026-10-20', false, 'sent'],
      ['2026-10-13', false, 'sent'],
      ['2026-10-21', true, 'failed'],
      ['2026-10-25', false, 'sending'],
    ] as const) {
      const id = randomUUID();
      await db().query(
        `INSERT INTO jobs(id,draft,fingerprint) VALUES($1::uuid,'{}',$1::text)`,
        [id],
      );
      await db().query(
        `INSERT INTO job_submissions(request_id,job_id,client_hash,payload_hash,is_test,created_at)
        VALUES($1,$1,'test','test',$2,$3)`,
        [id, isTest, date + 'T10:00:00+04:00'],
      );
      await db().query(
        `INSERT INTO swipe_applications(job_id,candidate_key,candidate_name,candidate_email,client_hash,cv_kind,recipient,status,created_at,sent_at)
        VALUES($1,$2,'Fixture','fixture@example.test',$2,'upload','employer@example.test',$3,'2026-09-01T00:00:00+04:00',$4)`,
        [
          id,
          'a'.repeat(64),
          status,
          status === 'sent' ? date + 'T10:00:00+04:00' : null,
        ],
      );
    }
    const params = ['2026-10-19T00:00:00+04:00', '2026-10-25T12:00:00+04:00'];
    const report = await analyticsComparison(params, 7);
    assert.equal(report.mode, 'completed-days');
    assert.equal(report.available, true);
    assert.equal(report.from, '2026-10-19T00:00');
    assert.equal(report.to, '2026-10-25T00:00');
    assert.equal(report.previousFrom, '2026-10-12T00:00');
    assert.equal(report.previousTo, '2026-10-18T00:00');
    assert.deepEqual(report.current, {
      search: 3,
      view: 1,
      outbound: 0,
      sends: 1,
      receivedPosts: 1,
    });
    assert.deepEqual(report.previous, {
      search: 2,
      view: 0,
      outbound: 1,
      sends: 1,
      receivedPosts: 1,
    });
    const today = await analyticsComparison(
      ['2026-10-25T00:00:00+04:00', params[1]],
      'today',
    );
    assert.equal(today.mode, 'same-time');
    assert.equal(today.previousTo, '2026-10-24T12:00');
    assert.equal(today.current.search, 1);
    assert.equal(today.previous.search, 1);
    const yesterday = await analyticsComparison(
      ['2026-10-24T00:00:00+04:00', '2026-10-25T00:00:00+04:00'],
      'yesterday',
    );
    assert.equal(yesterday.mode, 'full-day');
    assert.equal(yesterday.current.search, 2);
    assert.equal(yesterday.previous.search, 0);
    const old = await analyticsComparison(
      ['2026-07-28T00:00:00+04:00', params[1]],
      90,
    );
    assert.equal(
      old.available,
      false,
      'a period before the first recorded search is not a zero baseline',
    );
    await rollupAnalytics(db());
    assert.deepEqual(
      await analyticsComparison(params, 7),
      report,
      'daily aggregation changes no completed-day comparison',
    );
  },
);
