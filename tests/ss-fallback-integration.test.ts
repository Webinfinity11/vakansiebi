import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { Client } from 'pg';
import { db } from '../lib/server/db';
import { runSource } from '../worker/run';
import { tbilisiDate } from '../worker/adapters';
void test(
  'a recovered SS 403 imports JSON and retains safe diagnostics in source_runs.error',
  { skip: process.env.RUN_DB_TESTS !== '1' },
  async (t) => {
    const originalUrl = process.env.DATABASE_URL!;
    const url = new URL(originalUrl);
    assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
    assert.equal(url.pathname, '/ertad_test');
    const schema = 'ss_fallback_' + randomUUID().replaceAll('-', '');
    const c = new Client({ connectionString: originalUrl });
    await c.connect();
    try {
      await c.query(`CREATE SCHEMA ${schema}`);
      await c.query(`SET search_path TO ${schema}`);
      for (const f of readdirSync('db/migrations')
        .filter((f) => f.endsWith('.sql'))
        .sort())
        await c.query(readFileSync('db/migrations/' + f, 'utf8'));
      url.searchParams.set('options', '-c search_path=' + schema);
      process.env.DATABASE_URL = url.href;
      await db().query(
        "UPDATE sources SET enabled=true,reported_total=NULL,removal_swept_at=now(),discovery_page_limit=0 WHERE id='ss'",
      );
      const fixture = (name: string) =>
        readFileSync(`tests/fixtures/ss-next/${name}`, 'utf8');
      const listing = JSON.parse(fixture('listing.json'));
      listing.pageProps.searchInitData.result.items =
        listing.pageProps.searchInitData.result.items.slice(0, 1);
      listing.pageProps.searchInitData.result.items[0].startDate =
        tbilisiDate();
      listing.pageProps.searchInitData.result.totalCount = 1;
      const detail = JSON.parse(fixture('detail.json'));
      detail.pageProps.detailsInitData.startDate = tbilisiDate();
      detail.pageProps.detailsInitData.endDate = '2099-01-01';
      let deniedStatus = 403;
      t.mock.method(globalThis, 'fetch', async (input: URL) => {
        const u = new URL(input);
        if (u.pathname === '/robots.txt')
          return new Response('User-agent: *\nAllow: /');
        if (u.pathname === '/ka')
          return new Response(fixture('bootstrap.html'));
        if (u.pathname.startsWith('/_next/data/'))
          return new Response(
            JSON.stringify(u.pathname.includes('/details/') ? detail : listing),
          );
        return new Response(fixture('challenge.html'), {
          status: deniedStatus,
          headers: {
            server: 'cloudflare',
            'cf-mitigated': 'challenge',
            'cf-ray': 'a518d542cdc318a4-TBS',
            'content-type': 'text/html',
            'set-cookie': 'session=private-cookie',
          },
        });
      });
      const result = await runSource('ss', 1);
      assert.equal('imported' in result && result.imported, 1);
      const row = (
        await db().query(
          "SELECT status,error FROM source_runs WHERE source_id='ss' ORDER BY started_at DESC LIMIT 1",
        )
      ).rows[0];
      assert.equal(row.status, 'partial');
      assert.match(row.error, /Source returned HTTP 403/);
      assert.match(row.error, /cf-mitigated.*challenge/);
      assert.match(row.error, /a518d542cdc318a4-TBS/);
      assert.ok(!/secret|private-cookie|set-cookie/.test(row.error));
      assert.equal(
        (
          await db().query(
            "SELECT count(*)::int n FROM source_items WHERE source_id='ss' AND job_id IS NOT NULL",
          )
        ).rows[0].n,
        1,
      );
      for (const status of [429, 503]) {
        deniedStatus = status;
        await runSource('ss', 1);
        const failure = (
          await db().query(
            "SELECT status,error FROM source_runs WHERE source_id='ss' ORDER BY started_at DESC LIMIT 1",
          )
        ).rows[0];
        assert.equal(failure.status, 'failed');
        assert.ok(failure.error.includes(`"status":${status}`));
        assert.match(failure.error, /"server":"cloudflare"/);
        assert.ok(!/secret|private-cookie|set-cookie/.test(failure.error));
      }
    } finally {
      await db().end();
      process.env.DATABASE_URL = originalUrl;
      await c.query('SET search_path TO public');
      await c.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await c.end();
    }
  },
);
