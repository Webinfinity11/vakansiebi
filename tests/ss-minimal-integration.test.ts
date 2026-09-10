import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { db } from '../lib/server/db';
import { parseDetail, fingerprint } from '../worker/adapters';
import { reconcileJob } from '../worker/automation';
void test(
  'verified short and empty SS details automatically publish without invented description',
  { skip: process.env.RUN_DB_TESTS !== '1' },
  async () => {
    assert.equal(new URL(process.env.DATABASE_URL!).pathname, '/ertad_test');
    const c = await db().connect();
    try {
      await c.query('BEGIN');
      await c.query(
        "UPDATE sources SET auto_publish=true,enabled=true,retired=false WHERE id='ss'",
      );
      for (const description of ['Short genuine vacancy text.', null]) {
        const id = randomUUID(),
          item = randomUUID();
        const url = 'https://jobs.ss.ge/ka/details/test-999888777';
        const v = parseDetail(
          'ss',
          `<script id="__NEXT_DATA__">${JSON.stringify({ props: { pageProps: { detailsInitData: { id: 999888777, status: 0, jobsDealType: 1, title: { ka: 'Test ' + id }, publisherName: 'Verified employer', description: { ka: description } } } } })}</script>`,
          url,
        );
        await c.query(
          'INSERT INTO jobs(id,draft,fingerprint) VALUES($1,$2,$3)',
          [id, v, fingerprint(v)],
        );
        await c.query(
          "INSERT INTO source_items(id,source_id,external_id,url,job_id,raw,last_verified_at) VALUES($1,'ss',$2,$3,$4,$5,now())",
          [item, randomUUID(), url, id, v],
        );
        assert.equal(await reconcileJob(c, id), 'published');
        const j = (
          await c.query('SELECT published FROM jobs WHERE id=$1', [id])
        ).rows[0];
        assert.equal(j.published.description, description || '');
      }
    } finally {
      await c.query('ROLLBACK');
      c.release();
      await db().end();
    }
  },
);
