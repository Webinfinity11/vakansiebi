import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { Client } from 'pg';
import { db } from '../lib/server/db';
import { runSource } from '../worker/run';

void test(
  'closed Worknet pages advance within the budget, while repeated or unreadable pages retain the cursor',
  { skip: process.env.RUN_DB_TESTS !== '1' },
  async () => {
    const url = new URL(process.env.DATABASE_URL!);
    assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname));
    assert.equal(url.pathname, '/ertad_test');
    const schema = 'resilience_' + randomUUID().replaceAll('-', '');
    const c = new Client({ connectionString: url.href });
    const originalFetch = globalThis.fetch;
    const originalUrl = process.env.DATABASE_URL;
    const originalBudget = process.env.DISCOVERY_PAGE_BUDGET;
    await c.connect();
    try {
      await c.query(`CREATE SCHEMA ${schema}`);
      await c.query(`SET search_path TO ${schema}`);
      for (const file of readdirSync('db/migrations')
        .filter((f) => f.endsWith('.sql'))
        .sort())
        await c.query(readFileSync('db/migrations/' + file, 'utf8'));
      url.searchParams.set('options', '-c search_path=' + schema);
      process.env.DATABASE_URL = url.href;
      process.env.DISCOVERY_PAGE_BUDGET = '2';
      const detail = JSON.parse(
        readFileSync('tests/fixtures/worknet/detail.json', 'utf8'),
      );
      for (const mode of [
        'closed',
        'firstClosed',
        'repeated',
        'empty',
        'malformed',
      ]) {
        const listingRequests: number[] = [];
        await db().query(
          "UPDATE sources SET discovery_cursor=0,reported_total=NULL,quality_warning=NULL WHERE id='worknet'",
        );
        globalThis.fetch = async (input) => {
          const u = new URL(input instanceof Request ? input.url : input);
          if (u.pathname === '/robots.txt')
            return new Response('User-agent: *\nAllow: /');
          if (u.pathname.endsWith('/All')) {
            const page = Number(u.searchParams.get('pageIndex'));
            listingRequests.push(page);
            if (page === 2 && mode === 'malformed') return new Response('{bad');
            const items =
              page === 1
                ? mode === 'firstClosed'
                  ? [{ id: 700004, vacancyStatusId: 8 }]
                  : [{ id: 700001, vacancyStatusId: 1 }]
                : page === 2
                  ? mode === 'empty'
                    ? []
                    : [{ id: 700002, vacancyStatusId: 8 }]
                  : mode === 'repeated'
                    ? [{ id: 700002, vacancyStatusId: 8 }]
                    : [{ id: 700003, vacancyStatusId: 1 }];
            return new Response(
              JSON.stringify({ items, totalCount: 4, totalPages: 4 }),
            );
          }
          return new Response(
            JSON.stringify({ ...detail, id: Number(u.searchParams.get('Id')) }),
          );
        };
        const result = await runSource('worknet', 1);
        assert.ok(!('error' in result), JSON.stringify(result));
        const row = (
          await db().query(
            "SELECT discovery_cursor FROM sources WHERE id='worknet'",
          )
        ).rows[0];
        assert.equal(
          row.discovery_cursor,
          ['closed', 'firstClosed'].includes(mode)
            ? 2
            : mode === 'repeated'
              ? 1
              : 0,
          mode,
        );
        assert.deepEqual(
          listingRequests,
          mode === 'empty' || mode === 'malformed' ? [1, 2] : [1, 2, 3],
          mode,
        );
        assert.equal(
          (
            await db().query(
              "SELECT count(*)::int n FROM source_items WHERE external_id IN ('700002','700004')",
            )
          ).rows[0].n,
          0,
          'closed records are never imported',
        );
        if (mode === 'closed') {
          assert.equal(
            (
              await db().query(
                "SELECT count(*)::int n FROM source_items WHERE external_id IN ('700001','700003')",
              )
            ).rows[0].n,
            2,
          );
          assert.equal(
            (
              await db().query(
                "SELECT item_count FROM source_discovery_pages WHERE source_id='worknet' AND url LIKE '%pageIndex=2&%'",
              )
            ).rows[0].item_count,
            0,
          );
        }
      }
    } finally {
      globalThis.fetch = originalFetch;
      await db().end();
      process.env.DATABASE_URL = originalUrl;
      if (originalBudget === undefined)
        delete process.env.DISCOVERY_PAGE_BUDGET;
      else process.env.DISCOVERY_PAGE_BUDGET = originalBudget;
      await c.query('SET search_path TO public');
      await c.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await c.end();
    }
  },
);
