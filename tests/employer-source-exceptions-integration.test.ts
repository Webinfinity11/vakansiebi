import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { Client } from 'pg';
import { db } from '../lib/server/db';
import {
  employerRowsSql,
  employerPageSuppressed,
} from '../lib/server/employers';

void test(
  'approved official source exception retains aggregator and unrelated employer restrictions',
  { skip: process.env.RUN_DB_TESTS !== '1' },
  async () => {
    const url = new URL(process.env.DATABASE_URL!);
    assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
    assert.equal(url.pathname, '/ertad_test');
    const schema = 'exceptions_' + randomUUID().replaceAll('-', '');
    const c = new Client({ connectionString: url.href });
    const originalUrl = process.env.DATABASE_URL;
    await c.connect();
    try {
      await c.query(`CREATE SCHEMA ${schema}`);
      await c.query(`SET search_path TO ${schema}`);
      for (const name of readdirSync('db/migrations')
        .filter((n) => n.endsWith('.sql'))
        .sort())
        await c.query(readFileSync('db/migrations/' + name, 'utf8'));
      url.searchParams.set('options', '-c search_path=' + schema);
      process.env.DATABASE_URL = url.href;
      const rule = randomUUID(),
        jobId = randomUUID();
      await c.query(
        "INSERT INTO employer_suppressions(id,company_keys,reason,actor) VALUES($1,ARRAY['ლიბერთიბანკი'],'Admin restriction','admin')",
        [rule],
      );
      const official = {
        company: 'ლიბერთი ბანკი',
        source: 'libertybank.ge',
        url: 'https://www.libertybank.ge/ka/kariera/mimdinare-vakansiebi/1193/test',
      };
      await c.query('INSERT INTO jobs(id,draft,fingerprint) VALUES($1,$2,$3)', [
        jobId,
        official,
        'fixture',
      ]);
      assert.equal(
        (await c.query('SELECT status FROM jobs WHERE id=$1', [jobId])).rows[0]
          .status,
        'rejected',
      );
      await c.query(
        "UPDATE employer_suppressions SET allowed_source_hosts=ARRAY['libertybank.ge','www.libertybank.ge'] WHERE id=$1",
        [rule],
      );
      assert.equal(
        (
          await c.query('SELECT employer_suppression_for($1::jsonb) AS id', [
            official,
          ])
        ).rows[0].id,
        null,
      );
      for (const bad of [
        { ...official, source: 'jobs.ge', url: 'https://jobs.ge/ge/?id=123' },
        { ...official, url: 'https://www.libertybank.ge.evil.test/job' },
        { ...official, url: 'https://www.libertybank.ge@evil.test/job' },
        { ...official, url: 'http://www.libertybank.ge/job' },
        { ...official, url: 'https://www.libertybank.ge:444/job' },
        { ...official, source: 'jobs.ge' },
      ])
        assert.equal(
          (
            await c.query('SELECT employer_suppression_for($1::jsonb) AS id', [
              bad,
            ])
          ).rows[0].id,
          rule,
        );
      await c.query(
        "UPDATE jobs SET status='pending',automation_paused=false WHERE id=$1",
        [jobId],
      );
      assert.deepEqual(
        (
          await c.query(
            'SELECT status,employer_suppression_id FROM jobs WHERE id=$1',
            [jobId],
          )
        ).rows[0],
        { status: 'pending', employer_suppression_id: null },
      );
      await c.query(
        "UPDATE jobs SET status='published',published=draft,published_at=now() WHERE id=$1",
        [jobId],
      );
      await c.query(
        "INSERT INTO source_items(id,source_id,external_id,url,job_id) VALUES($1,'liberty','1193',$2,$3)",
        [randomUUID(), official.url, jobId],
      );
      assert.ok(
        (await c.query(employerRowsSql)).rows.some((row) =>
          row.ids.includes(jobId),
        ),
        'official employer page retains its source identity',
      );
      const page = {
        slug: 'liberty',
        name: official.company,
        logoUrl: '',
        names: [official.company],
        jobIds: [jobId],
        example: { title: '', category: '', city: '' },
        cities: [],
      };
      assert.equal(await employerPageSuppressed(page), false);
      await c.query(
        "UPDATE jobs SET status='archived',published=NULL WHERE id=$1",
        [jobId],
      );
      assert.equal(
        (
          await c.query(
            'SELECT snapshot FROM employer_page_history WHERE job_id=$1',
            [jobId],
          )
        ).rows[0].snapshot.source,
        'libertybank.ge',
      );
      assert.equal(
        await employerPageSuppressed(page),
        false,
        'official history keeps the approved exception',
      );
      const blocked = randomUUID();
      await c.query('INSERT INTO jobs(id,draft,fingerprint) VALUES($1,$2,$3)', [
        blocked,
        { ...official, source: 'jobs.ge', url: 'https://jobs.ge/ge/?id=123' },
        'blocked',
      ]);
      await c.query(
        "UPDATE jobs SET draft=jsonb_set(draft,'{company}','\"Edited name\"'),status='published' WHERE id=$1",
        [blocked],
      );
      assert.equal(
        (await c.query('SELECT status FROM jobs WHERE id=$1', [blocked]))
          .rows[0].status,
        'rejected',
        'renaming must not evade the stored restriction',
      );
    } finally {
      await db().end();
      delete (globalThis as { ertadPool?: unknown }).ertadPool;
      process.env.DATABASE_URL = originalUrl;
      await c.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await c.end();
    }
  },
);
