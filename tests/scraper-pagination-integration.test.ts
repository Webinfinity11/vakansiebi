import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { Client } from 'pg';
import { db } from '../lib/server/db';
import { runSource } from '../worker/run';
import { tbilisiDate } from '../worker/adapters';
import { refreshDescriptions } from '../worker/refresh';

void test(
  'new-only Worknet discovery starts at page one and stops on known, repeated or unreadable pages',
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
      detail.startDate = tbilisiDate();
      detail.endDate = tbilisiDate(new Date(Date.now() + 30 * 86400000));
      let scenario = 0;
      for (const mode of [
        'closed',
        'firstClosed',
        'repeated',
        'empty',
        'malformed',
        'known',
      ]) {
        const listingRequests: number[] = [];
        const first = 700001 + scenario++ * 100;
        const second = first + 1;
        const third = first + 2;
        const closedFirst = first + 3;
        await db().query(
          "UPDATE sources SET discovery_cursor=7,reported_total=NULL,quality_warning=NULL WHERE id='worknet'",
        );
        // Existing IDs must also stop pagination, independently of malformed pages.
        if (mode === 'known') {
          for (const id of [first, second])
            await db().query(
              "INSERT INTO source_items(id,source_id,external_id,url,raw,next_check_at) VALUES($1,'worknet',$2,$3,$4,'infinity')",
              [
                randomUUID(),
                String(id),
                `https://worknet.moh.gov.ge/ka-ge/vacancy/${id}`,
                detail,
              ],
            );
        }
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
                  ? [{ id: closedFirst, vacancyStatusId: 8 }]
                  : [{ id: first, vacancyStatusId: 1 }]
                : page === 2
                  ? mode === 'empty'
                    ? []
                    : [
                        {
                          id: second,
                          vacancyStatusId: mode === 'known' ? 1 : 8,
                        },
                      ]
                  : mode === 'repeated'
                    ? [{ id: second, vacancyStatusId: 8 }]
                    : [{ id: third, vacancyStatusId: 1 }];
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
          7, // 64a5c0e starts from page one and never rotates the legacy cursor.
          mode,
        );
        assert.deepEqual(
          listingRequests,
          ['empty', 'malformed', 'firstClosed', 'known'].includes(mode)
            ? [1, 2]
            : [1, 2, 3],
          mode,
        );
        assert.equal(
          (
            await db().query(
              'SELECT count(*)::int n FROM source_items WHERE external_id=ANY($1::text[])',
              [
                [
                  String(closedFirst),
                  ...(mode === 'known' ? [] : [String(second)]),
                ],
              ],
            )
          ).rows[0].n,
          0,
          'closed records are never imported',
        );
        if (['empty', 'malformed', 'repeated'].includes(mode)) {
          const warning = (
            await db().query(
              "SELECT error FROM source_runs WHERE source_id='worknet' ORDER BY started_at DESC LIMIT 1",
            )
          ).rows[0].error;
          // Worknet's parser returns no links for malformed JSON, so the
          // runner reports the same empty-page stop without advancing further.
          assert.match(warning, mode === 'repeated' ? /repeated/ : /empty/);
        }
        if (mode === 'closed') {
          assert.equal(
            (
              await db().query(
                'SELECT count(*)::int n FROM source_items WHERE external_id=ANY($1::text[])',
                [[String(first), String(third)]],
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
      await db().query(
        "UPDATE sources SET batch_limit=1,discovery_page_limit=0,repair_limit=0 WHERE id='worknet'",
      );
      const requestedPages: number[] = [];
      let details = 0;
      globalThis.fetch = async (input) => {
        const u = new URL(input instanceof Request ? input.url : String(input));
        if (u.pathname === '/robots.txt')
          return new Response('User-agent: *\nAllow: /');
        if (u.pathname.endsWith('/All')) {
          requestedPages.push(Number(u.searchParams.get('pageIndex')));
          return Response.json({
            items: [
              { id: 700010, vacancyStatusId: 1 },
              { id: 700011, vacancyStatusId: 1 },
            ],
            totalCount: 4,
            totalPages: 4,
          });
        }
        details++;
        return Response.json({
          ...detail,
          id: Number(u.searchParams.get('Id')),
        });
      };
      const limited = await runSource('worknet', 200);
      assert.ok(!('error' in limited), JSON.stringify(limited));
      assert.deepEqual(
        requestedPages,
        [1],
        'zero extra pages still reads the newest listing',
      );
      assert.equal(
        details,
        1,
        'database batch limit overrides larger runner limit',
      );
      const measured = (
        await db().query(
          "SELECT metrics FROM source_runs WHERE source_id='worknet' ORDER BY started_at DESC LIMIT 1",
        )
      ).rows[0].metrics;
      assert.equal(measured.batch_limit, 1);
      assert.equal(measured.new_attempts + measured.recheck_attempts, 1);
      globalThis.fetch = async () => {
        throw new Error('disabled repair must not fetch');
      };
      assert.equal((await refreshDescriptions('worknet')).skipped, true);
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
