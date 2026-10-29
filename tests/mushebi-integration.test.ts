import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { load } from 'cheerio';
import { Client } from 'pg';
import { db } from '../lib/server/db';
import { runSource } from '../worker/run';

void test(
  'Mushebi imports once, refreshes daily pay, removes missing roles and preserves editor changes',
  { skip: process.env.RUN_DB_TESTS !== '1' },
  async () => {
    const target = new URL(process.env.DATABASE_URL!);
    assert.ok(['localhost', '127.0.0.1'].includes(target.hostname));
    assert.equal(target.pathname, '/ertad_test');
    const schema = 'mushebi_' + randomUUID().replaceAll('-', '');
    const c = new Client({ connectionString: target.href });
    const originalUrl = process.env.DATABASE_URL,
      originalFetch = globalThis.fetch;
    let html = readFileSync('tests/fixtures/mushebi-careers.html', 'utf8');
    let pages = 0;
    await c.connect();
    try {
      await c.query(`CREATE SCHEMA ${schema}`);
      await c.query(`SET search_path TO ${schema}`);
      for (const name of readdirSync('db/migrations')
        .filter((n) => n.endsWith('.sql'))
        .sort())
        await c.query(readFileSync('db/migrations/' + name, 'utf8'));
      await c.query(
        "UPDATE sources SET enabled=true,auto_enabled=true,auto_publish=true WHERE id='mushebi'",
      );
      target.searchParams.set('options', '-c search_path=' + schema);
      process.env.DATABASE_URL = target.href;
      globalThis.fetch = async (input) => {
        const u = new URL(input instanceof Request ? input.url : String(input));
        assert.equal(
          u.origin,
          'https://mushebi.ge',
          'no third-party fetches, messages or indexing requests',
        );
        if (u.pathname === '/robots.txt')
          return new Response('User-agent: *\nAllow: /');
        assert.equal(u.pathname, '/ka/vacancies');
        pages++;
        return new Response(html);
      };
      const first = await runSource('mushebi', 10);
      assert.equal(
        'imported' in first && first.imported,
        3,
        JSON.stringify(first),
      );
      const rows = (
        await db().query(
          "SELECT id,status,published FROM jobs ORDER BY published->>'title'",
        )
      ).rows;
      assert.equal(rows.length, 3);
      assert.ok(
        rows.every(
          (r) =>
            r.status === 'published' &&
            r.published.salaryPeriod === 'დღე' &&
            !r.published.datePosted &&
            !r.published.deadline,
        ),
      );
      assert.equal(pages, 1, 'one fetch contains all three roles');
      assert.equal('imported' in (await runSource('mushebi', 10)), true);
      assert.equal(
        (await db().query('SELECT count(*)::int AS n FROM jobs')).rows[0].n,
        3,
      );
      const driver = rows.find((r) => r.published.title === 'სატვირთო მძღოლი')!;
      await db().query('UPDATE jobs SET automation_paused=true WHERE id=$1', [
        driver.id,
      ]);
      const $ = load(html);
      $('h2')
        .filter((_, e) => $(e).text() === 'დამხმარე მუშა')
        .parent()
        .remove();
      html = $.html()
        .replace('50-80₾/დღე', '65-90₾/დღე')
        .replace('70-120₾/დღე', '80-130₾/დღე');
      await runSource('mushebi', 10);
      const updated = (
        await db().query('SELECT status,published,draft FROM jobs')
      ).rows;
      assert.equal(
        updated.find((r) => r.draft.title === 'მტვირთავი / მუშა')?.published
          .salaryMin,
        65,
      );
      assert.equal(
        updated.find((r) => r.draft.title === 'დამხმარე მუშა')?.status,
        'archived',
      );
      assert.equal(
        updated.find((r) => r.draft.title === 'სატვირთო მძღოლი')?.published
          .salaryMin,
        70,
        'editor pause is preserved',
      );
      html = '<main>Temporarily unavailable</main>';
      const failure = await runSource('mushebi', 10);
      assert.ok('error' in failure);
      assert.equal(
        (
          await db().query(
            "SELECT count(*)::int AS n FROM jobs WHERE status='published'",
          )
        ).rows[0].n,
        2,
        'network/structure failure must not remove valid roles',
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
