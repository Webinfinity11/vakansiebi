import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { load } from 'cheerio';
import { Client } from 'pg';
import { db } from '../lib/server/db';
import { runSource } from '../worker/run';

void test(
  'Infobatumi pipeline publishes fresh daily jobs once and excludes stale and closed vacancies',
  { skip: process.env.RUN_DB_TESTS !== '1' },
  async () => {
    const url = new URL(process.env.DATABASE_URL!);
    assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
    assert.equal(url.pathname, '/ertad_test');
    const schema = 'infobatumi_' + randomUUID().replaceAll('-', '');
    const c = new Client({ connectionString: url.href });
    const originalUrl = process.env.DATABASE_URL,
      originalFetch = globalThis.fetch;
    const origin = 'https://www.infobatumi.ge';
    const ids = ['38291', '38284', '38285'];
    const requests: string[] = [];
    const listing =
      '<span class="result-count">3 სულ</span><div data-id="0354c20">' +
      ids
        .map(
          (id) =>
            `<div class="ts-preview" data-post-id="${id}"><h3><a href="${origin}/vakansiebi/fixture-${id}/">ვაკანსია</a></h3></div>`,
        )
        .join('') +
      '</div>';
    await c.connect();
    try {
      await c.query(`CREATE SCHEMA ${schema}`);
      await c.query(`SET search_path TO ${schema}`);
      for (const name of readdirSync('db/migrations')
        .filter((f) => f.endsWith('.sql'))
        .sort())
        await c.query(readFileSync('db/migrations/' + name, 'utf8'));
      assert.equal(
        (await c.query("SELECT enabled FROM sources WHERE id='infobatumi'"))
          .rows[0].enabled,
        false,
      );
      await c.query(
        "UPDATE sources SET enabled=true,auto_enabled=true,auto_publish=true WHERE id='infobatumi'",
      );
      url.searchParams.set('options', '-c search_path=' + schema);
      process.env.DATABASE_URL = url.href;
      globalThis.fetch = async (input) => {
        const u = new URL(input instanceof Request ? input.url : String(input));
        assert.equal(u.origin, origin);
        requests.push(u.href);
        if (u.pathname === '/robots.txt')
          return new Response('User-agent: *\nAllow: /');
        if (u.pathname === '/vakansiebi/') return new Response(listing);
        const id = u.searchParams.get('p');
        assert.ok(id && ids.includes(id));
        const $ = load(
          readFileSync('tests/fixtures/infobatumi-cook.html', 'utf8'),
        );
        $('body').attr('class', `single-vakansiebi postid-${id}`);
        $('[data-id="586f795"]').text(
          id === '38284'
            ? 'განთავსებულია 8 დღის წინ'
            : 'განთავსებულია 1 საათის წინ',
        );
        $('[data-id="866cc03"]').text('ბოლო ვადა: 29 ნოემბერი 2099');
        if (id === '38285')
          $('[data-id="06d28bc"]').html('<h2>ვაკანსია აღარ არის აქტიური</h2>');
        return new Response($.html());
      };
      const first = await runSource('infobatumi', 10);
      assert.ok(!('error' in first), JSON.stringify(first));
      const jobs = (await db().query('SELECT status,published FROM jobs')).rows;
      assert.equal(jobs.length, 1);
      assert.equal(jobs[0].status, 'published');
      assert.equal(jobs[0].published.salaryMin, 80);
      assert.equal(jobs[0].published.salaryPeriod, 'დღე');
      assert.equal(jobs[0].published.source, 'infobatumi.ge');
      const skipped = (
        await db().query(
          "SELECT external_id,job_id FROM source_items WHERE source_id='infobatumi' AND external_id<> '38291'",
        )
      ).rows;
      assert.equal(skipped.length, 2);
      assert.ok(skipped.every((row) => row.job_id === null));
      const details = requests.filter((u) => u.includes('?p=')).length;
      assert.equal(details, 3);
      const second = await runSource('infobatumi', 10);
      assert.ok(!('error' in second), JSON.stringify(second));
      assert.equal(requests.filter((u) => u.includes('?p=')).length, details);
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
