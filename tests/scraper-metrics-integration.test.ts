import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { db } from '../lib/server/db';
import { scraperMetrics } from '../lib/server/scraper-metrics';

void test(
  'scraper dashboard aggregates recorded work and preserves unknown historical attempts',
  { skip: process.env.RUN_DB_TESTS !== '1' },
  async () => {
    assert.equal(new URL(process.env.DATABASE_URL!).pathname, '/ertad_test');
    const client = await db().connect();
    try {
      await client.query('BEGIN');
      const measured = `metrics-${randomUUID()}`,
        legacy = `legacy-${randomUUID()}`;
      await client.query('INSERT INTO sources(id,name) VALUES($1,$1),($2,$2)', [
        measured,
        legacy,
      ]);
      await client.query(
        `INSERT INTO source_runs(id,source_id,started_at,finished_at,status,imported,changed,metrics,run_kind)
      VALUES($1,$2,now()-interval '2 minutes',now(),'success',3,2,$3,'discovery'),
      ($4,$5,now()-interval '1 minute',now(),'success',7,1,NULL,'legacy')`,
        [
          randomUUID(),
          measured,
          { new_attempts: 5, recheck_attempts: 8, unchanged: 4, linked: 1 },
          randomUUID(),
          legacy,
        ],
      );
      const report = await scraperMetrics(client);
      const current = report.sources.find((r) => r.label === measured)!;
      assert.equal(current.imported, 3);
      assert.equal(current.recheck_attempts, 8);
      assert.equal(current.new_attempts, 5);
      assert.equal(current.unchanged, 4);
      assert.equal(current.linked, 1);
      assert.equal(current.minutes, 2);
      const old = report.sources.find((r) => r.label === legacy)!;
      assert.equal(old.imported, 7);
      assert.equal(old.recheck_attempts, null);
      assert.equal(old.measured_runs, 0);
      assert.equal(report.daily.length, 7);
      assert.equal(
        report.daily[0].label,
        new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tbilisi' }).format(
          new Date(),
        ),
      );
      assert.ok(report.daily.every((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.label)));
    } finally {
      await client.query('ROLLBACK');
      client.release();
      await db().end();
    }
  },
);
