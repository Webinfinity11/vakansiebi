import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from 'pg';
import { detailQueueProjection } from '../worker/detail-queue';
import { reconciliationJobProjection } from '../worker/automation';
import { employerRowsSql } from '../lib/server/employers';

void test(
  'compact database reads preserve snapshots, linked text and employer membership',
  { skip: !process.env.TRANSFER_TEST_DATABASE_URL },
  async () => {
    const url = new URL(process.env.TRANSFER_TEST_DATABASE_URL!);
    assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname));
    assert.equal(url.pathname, '/ertad_test');
    const c = new Client({ connectionString: url.href });
    await c.connect();
    try {
      await c.query('BEGIN');
      await c.query(`CREATE TEMP TABLE jobs (id text PRIMARY KEY,status text,automation_paused boolean,automation_managed boolean,draft jsonb,published jsonb);
        CREATE TEMP TABLE sources(id text,retired boolean);
        CREATE TEMP TABLE source_items(id text,job_id text,source_id text,url text,listing_hints jsonb,failures int,raw jsonb,quality_candidate jsonb);
        INSERT INTO sources VALUES ('hr',false),('jobs',false);`);
      const original = {
        title: 'Developer',
        company: 'Studio',
        city: 'თბილისი',
        description: 'unchanged text '.repeat(1000),
        facts: [{ label: 'გრაფიკი', value: '09:00–18:00' }],
      };
      const edited = { ...original, title: 'Editor title' };
      for (const [id, draft, published] of [
        ['a', original, original],
        ['b', edited, original],
        ['c', original, null],
      ] as const) {
        await c.query('INSERT INTO jobs VALUES($1,$2,false,true,$3,$4)', [
          id,
          published ? 'published' : 'pending',
          draft,
          published,
        ]);
      }
      const rows = (
        await c.query(
          `SELECT ${reconciliationJobProjection} FROM jobs ORDER BY id`,
        )
      ).rows;
      assert.deepEqual(
        rows.map((r) => (r.draft_is_published ? r.published : r.draft)),
        [original, edited, original],
      );
      assert.deepEqual(
        rows.map((r) => r.published),
        [original, original, null],
      );
      const linked = {
        ...original,
        fullTextUrl: 'https://example.org/job/1',
        logoUrl: 'https://example.org/logo.png',
      };
      for (const [id, raw] of [
        ['a', original],
        ['b', linked],
      ] as const) {
        await c.query(
          "INSERT INTO source_items VALUES($1,$1,'hr','https://example.org/job',$2,0,$3,$3)",
          [id, { city: 'თბილისი' }, raw],
        );
      }
      const queue = (
        await c.query(
          `SELECT ${detailQueueProjection} FROM source_items ORDER BY id`,
        )
      ).rows;
      assert.equal(
        queue[0].raw,
        null,
        'ordinary text is not needed for linked-description reuse',
      );
      assert.deepEqual(queue[0].listing_hints, { city: 'თბილისი' });
      assert.deepEqual(queue[1].raw, {
        description: linked.description,
        fullTextUrl: linked.fullTextUrl,
        logoUrl: linked.logoUrl,
      });
      assert.equal('quality_candidate' in queue[1], false);
      assert.ok(
        Buffer.byteLength(JSON.stringify(queue)) <
          Buffer.byteLength(
            JSON.stringify((await c.query('SELECT * FROM source_items')).rows),
          ) /
            2,
      );
      let employers = (await c.query(employerRowsSql)).rows;
      assert.equal(
        employers.length,
        1,
        'repeated employer attributes travel once',
      );
      assert.deepEqual(employers[0].ids, ['a', 'b']);
      assert.deepEqual(employers[0].sources, ['hr']);
      await c.query(
        "INSERT INTO source_items(id,job_id,source_id) VALUES('extra','b','jobs')",
      );
      employers = (await c.query(employerRowsSql)).rows;
      assert.equal(
        employers.length,
        2,
        'a different source identity is not folded away',
      );
      assert.deepEqual(
        employers
          .flatMap((r) => r.ids)
          .sort((a: string, b: string) => a.localeCompare(b)),
        ['a', 'b'],
      );
    } finally {
      await c.query('ROLLBACK');
      await c.end();
    }
  },
);
