import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { Client } from 'pg';
import { db } from '../lib/server/db';
import { runSource } from '../worker/run';

void test(
  'Liberty pipeline imports an undated official vacancy once and excludes expired posts',
  { skip: process.env.RUN_DB_TESTS !== '1' },
  async () => {
    const url = new URL(process.env.DATABASE_URL!);
    assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
    assert.equal(url.pathname, '/ertad_test');
    const schema = 'liberty_' + randomUUID().replaceAll('-', '');
    const c = new Client({ connectionString: url.href });
    const originalUrl = process.env.DATABASE_URL;
    const originalFetch = globalThis.fetch;
    const origin = 'https://www.libertybank.ge';
    const careers = '/ka/kariera/mimdinare-vakansiebi';
    const title = 'სესხის ოფიცერი - თბილისი';
    const dates = ['11 ნოემბერი, 2099', '11 ნოემბერი, 2000'];
    const items = dates.map((endDate, i) => ({
      id: 1193 + i,
      title,
      endDate,
      url: `${origin}${careers}/${1193 + i}/fixture`,
      location: { title: 'თბილისი' },
      category: { title: 'საკრედიტო' },
    }));
    const requests: string[] = [];
    await c.connect();
    try {
      await c.query(`CREATE SCHEMA ${schema}`);
      await c.query(`SET search_path TO ${schema}`);
      for (const name of readdirSync('db/migrations')
        .filter((f) => f.endsWith('.sql'))
        .sort())
        await c.query(readFileSync('db/migrations/' + name, 'utf8'));
      const state = (
        await c.query(
          "SELECT enabled,auto_enabled,auto_publish FROM sources WHERE id='liberty'",
        )
      ).rows[0];
      assert.deepEqual(state, {
        enabled: false,
        auto_enabled: false,
        auto_publish: false,
      });
      await c.query(
        "UPDATE sources SET enabled=true,auto_enabled=true,auto_publish=true WHERE id='liberty'",
      );
      url.searchParams.set('options', '-c search_path=' + schema);
      process.env.DATABASE_URL = url.href;
      globalThis.fetch = async (input) => {
        const u = new URL(input instanceof Request ? input.url : String(input));
        assert.equal(
          u.origin,
          origin,
          'no aggregator, external API or indexing request',
        );
        requests.push(u.pathname);
        if (u.pathname === '/robots.txt')
          return new Response('User-agent: *\nAllow: /');
        if (u.pathname === careers)
          return new Response(
            `<script>window.vacancies = ${JSON.stringify(items)};</script>`,
          );
        const item = items.find((row) => row.url === u.href);
        assert.ok(item, u.href);
        return new Response(`<link rel="canonical" href="${item.url}"><div class="vacancy-content">
          <div class="pagetitle"><h2>${title}</h2></div><div class="pagetext">
          <h2>ადგილმდებარეობა</h2><p>თბილისი</p><h2>ბოლო ვადა</h2><p>${item.endDate}</p>
          <h2>აღწერა</h2><p>ლიბერთი ბანკი ეძებს სესხის ოფიცერს თბილისში. აუცილებელია მომხმარებელთან კომუნიკაციის უნარი და პასუხისმგებლობა.</p></div></div>`);
      };
      const first = await runSource('liberty', 10);
      assert.ok(!('error' in first), JSON.stringify(first));
      const jobs = (await db().query('SELECT status,published FROM jobs')).rows;
      assert.equal(jobs.length, 1);
      assert.equal(jobs[0].status, 'published');
      assert.equal(jobs[0].published.datePosted, '');
      assert.equal(jobs[0].published.source, 'libertybank.ge');
      assert.equal(jobs[0].published.url, items[0].url);
      assert.equal(jobs[0].published.deadline, '2099-11-11');
      const expired = (
        await db().query(
          "SELECT job_id FROM source_items WHERE source_id='liberty' AND external_id='1194'",
        )
      ).rows[0];
      assert.equal(expired.job_id, null);
      const detailCount = requests.filter((path) =>
        path.startsWith(careers + '/'),
      ).length;
      assert.equal(detailCount, 2);
      const second = await runSource('liberty', 10);
      assert.ok(!('error' in second), JSON.stringify(second));
      assert.equal(
        requests.filter((path) => path.startsWith(careers + '/')).length,
        detailCount,
      );
      assert.equal(
        (await db().query('SELECT count(*)::int AS n FROM jobs')).rows[0].n,
        1,
      );
    } finally {
      globalThis.fetch = originalFetch;
      await db().end();
      delete (globalThis as { ertadPool?: unknown }).ertadPool;
      process.env.DATABASE_URL = originalUrl;
      await c.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await c.end();
    }
  },
);
