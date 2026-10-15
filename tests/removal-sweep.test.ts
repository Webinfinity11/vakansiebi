import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { Client } from 'pg';
import { db } from '../lib/server/db';
import { sweepComplete, sweepRemovals } from '../worker/removal-sweep';

void test('a removal walk needs nearly the whole listing before calling anything missing', () => {
  assert.equal(sweepComplete(3440, 3441, null), true);
  assert.equal(sweepComplete(1935, 2286, null), false);
  assert.equal(sweepComplete(5512, null, 5600), true);
  assert.equal(sweepComplete(3000, null, 5600), false);
  assert.equal(sweepComplete(0, null, null), false);
});

void test(
  'hr.ge vacancies missing from two complete walks a day apart are archived',
  { skip: process.env.RUN_DB_TESTS !== '1' },
  async () => {
    const url = new URL(process.env.DATABASE_URL!);
    assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname));
    assert.equal(url.pathname, '/ertad_test');
    const schema = 'sweep_' + randomUUID().replaceAll('-', '');
    const c = new Client({ connectionString: url.href });
    const originalFetch = globalThis.fetch;
    const originalUrl = process.env.DATABASE_URL;
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
      await db().query(
        `INSERT INTO sources(id,name,enabled,auto_publish) VALUES('hr','hr.ge',true,true)
         ON CONFLICT(id) DO UPDATE SET enabled=true,auto_publish=true`,
      );
      const jobs: Record<string, string> = {};
      for (const external of ['100', '200', '300']) {
        const id = randomUUID();
        jobs[external] = id;
        const v = {
          title: 'მოლარე ' + external,
          company: 'კომპანია',
          city: 'თბილისი',
          description: 'ვეძებთ მოლარეს. '.repeat(5),
          url: `https://www.hr.ge/announcement/${external}/x`,
          source: 'hr.ge',
          datePosted: '2026-10-10',
          deadline: '2099-01-01',
        };
        await db().query(
          `INSERT INTO jobs(id,draft,published,status,fingerprint,automation_managed)
           VALUES($1,$2,$2,'published',$3,true)`,
          [id, v, 'fp' + external],
        );
        await db().query(
          `INSERT INTO source_items(id,source_id,external_id,url,job_id,raw,discovered_at,last_verified_at,next_check_at)
           VALUES($1,'hr',$2,$3,$4,$5,now()-interval '2 days',now(),'infinity')`,
          [randomUUID(), external, v.url, id, v],
        );
      }
      let listed = ['100', '200', '300'];
      let reported = 3;
      globalThis.fetch = (async (input: string | URL) => {
        const u = new URL(String(input));
        if (u.pathname === '/robots.txt')
          return new Response('User-agent: *\nAllow: /');
        const state = {
          k: {
            b: {
              data: {
                announcements: {
                  totalCount: reported,
                  items: listed.map((id) => ({ announcementId: Number(id) })),
                },
              },
            },
          },
        };
        return new Response(
          listed.map((id) => `<a href="/announcement/${id}/x">x</a>`).join('') +
            `<script id="ng-state" type="application/json">${JSON.stringify(state)}</script>`,
        );
      }) as typeof fetch;
      const status = async (external: string) =>
        (
          await db().query('SELECT status FROM jobs WHERE id=$1', [
            jobs[external],
          ])
        ).rows[0].status;
      const ago = async () =>
        db().query(
          "UPDATE sources SET removal_swept_at=now()-interval '21 hours' WHERE id='hr'",
        );

      assert.equal((await sweepRemovals('hr'))?.complete, true);
      // 200 and 300 disappear: the first walk only remembers it.
      listed = ['100'];
      reported = 1;
      await ago();
      assert.deepEqual(await sweepRemovals('hr'), {
        complete: true,
        seen: 1,
        missing: 2,
        removed: 0,
      });
      assert.equal(await status('200'), 'published');
      // Not due again within the day.
      assert.equal(await sweepRemovals('hr'), null);
      // 300 was a reshuffle and comes back; 200 is still gone a day later.
      listed = ['100', '300'];
      reported = 2;
      await db().query(
        "UPDATE source_items SET missing_since=now()-interval '21 hours' WHERE missing_since IS NOT NULL",
      );
      await ago();
      assert.equal((await sweepRemovals('hr'))?.removed, 1);
      assert.equal(await status('200'), 'archived');
      assert.equal(await status('300'), 'published');
      assert.equal(await status('100'), 'published');
      // A short walk changes nothing.
      listed = [];
      reported = 3;
      await ago();
      assert.equal((await sweepRemovals('hr'))?.complete, false);
      assert.equal(await status('100'), 'published');
    } finally {
      globalThis.fetch = originalFetch;
      await db().end();
      process.env.DATABASE_URL = originalUrl;
      await c.query('SET search_path TO public');
      await c.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await c.end();
    }
  },
);
