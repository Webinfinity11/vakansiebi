import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, generateKeyPairSync } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { Client, Pool } from 'pg';
import { reserveIndexingBudget } from '../lib/server/google-indexing';

void test(
  'indexing daily budget is atomic across connections and resets at Pacific midnight including DST',
  { skip: process.env.RUN_DB_TESTS !== '1' },
  async () => {
    const url = new URL(process.env.DATABASE_URL!);
    assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
    assert.equal(url.pathname, '/ertad_test');
    const schema = 'indexing_' + randomUUID().replaceAll('-', '');
    const client = new Client({ connectionString: url.href });
    await client.connect();
    const pool = new Pool({
      connectionString: url.href,
      options: `-c search_path=${schema}`,
      max: 8,
    });
    try {
      await client.query(`CREATE SCHEMA ${schema}`);
      await client.query(`SET search_path TO ${schema}`);
      const migration = readFileSync(
        'db/migrations/037_google_indexing_daily.sql',
        'utf8',
      );
      await client.query(migration);
      await client.query(migration);
      const beforeMidnight = new Date('2026-07-02T06:59:59Z');
      const attempts = await Promise.all(
        Array.from({ length: 30 }, () =>
          reserveIndexingBudget(7, pool, beforeMidnight),
        ),
      );
      assert.equal(attempts.filter(Boolean).length, 7);
      assert.deepEqual(
        (
          await client.query(
            'SELECT day::text, requests FROM google_indexing_daily',
          )
        ).rows,
        [{ day: '2026-07-01', requests: 7 }],
      );
      assert.equal(await reserveIndexingBudget(7, pool, beforeMidnight), false);
      assert.equal(await reserveIndexingBudget(0, pool, beforeMidnight), false);
      assert.equal(
        await reserveIndexingBudget(7, pool, new Date('2026-07-02T07:00:00Z')),
        true,
      );
      for (const time of [
        '2026-01-02T07:59:59Z',
        '2026-01-02T08:00:00Z',
        '2026-03-08T09:59:59Z',
        '2026-03-08T10:00:00Z',
        '2026-11-01T08:59:59Z',
        '2026-11-01T09:00:00Z',
      ])
        assert.equal(
          await reserveIndexingBudget(7, pool, new Date(time)),
          true,
        );
      assert.deepEqual(
        (
          await client.query(
            'SELECT day::text, requests FROM google_indexing_daily ORDER BY day',
          )
        ).rows,
        [
          { day: '2026-01-01', requests: 1 },
          { day: '2026-01-02', requests: 1 },
          { day: '2026-03-08', requests: 2 },
          { day: '2026-07-01', requests: 7 },
          { day: '2026-07-02', requests: 1 },
          { day: '2026-11-01', requests: 2 },
        ],
      );
    } finally {
      await pool.end();
      await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await client.end();
    }
  },
);

void test(
  'worker import and archive notify after commit, while unchanged and rolled-back imports send nothing',
  { skip: process.env.RUN_DB_TESTS !== '1' },
  async () => {
    const url = new URL(process.env.DATABASE_URL!);
    assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
    assert.equal(url.pathname, '/ertad_test');
    const schema = 'indexing_worker_' + randomUUID().replaceAll('-', '');
    const client = new Client({ connectionString: url.href });
    await client.connect();
    const pool = new Pool({
      connectionString: url.href,
      options: `-c search_path=${schema}`,
      max: 5,
    });
    const globals = globalThis as unknown as { ertadPool?: Pool };
    const previousPool = globals.ertadPool;
    const originalFetch = globalThis.fetch;
    const previousEmail = process.env.GOOGLE_INDEXING_CLIENT_EMAIL;
    const previousKey = process.env.GOOGLE_INDEXING_PRIVATE_KEY;
    const previousLimit = process.env.GOOGLE_INDEXING_DAILY_LIMIT;
    try {
      await client.query(`CREATE SCHEMA ${schema}`);
      await client.query(`SET search_path TO ${schema}`);
      for (const name of readdirSync('db/migrations')
        .filter((name) => name.endsWith('.sql'))
        .sort())
        await client.query(readFileSync('db/migrations/' + name, 'utf8'));
      globals.ertadPool = pool;
      await pool.query(
        "INSERT INTO sources(id,name,enabled,auto_publish) VALUES('hr','hr.ge',true,true) ON CONFLICT(id) DO UPDATE SET enabled=true,auto_publish=true,retired=false",
      );
      process.env.GOOGLE_INDEXING_CLIENT_EMAIL = 'test@example.invalid';
      process.env.GOOGLE_INDEXING_PRIVATE_KEY = generateKeyPairSync('rsa', {
        modulusLength: 2048,
      })
        .privateKey.export({ type: 'pkcs8', format: 'pem' })
        .toString();
      process.env.GOOGLE_INDEXING_DAILY_LIMIT = '200';
      const { stageVacancy } = await import('../worker/importer');
      const { reconcileAndNotify } = await import('../worker/automation');
      const { tbilisiDate } = await import('../worker/adapters');
      const itemId = randomUUID();
      const vacancy = {
        title: 'Developer',
        company: 'Indexing fixture',
        city: 'თბილისი',
        category: 'ტექნოლოგიები',
        salary: '',
        salaryMin: null,
        currency: '',
        salaryPeriod: '',
        mode: '',
        description:
          'Join our experienced development team and create useful products.',
        url: 'https://www.hr.ge/announcement/99981234/test',
        source: 'hr.ge',
        datePosted: tbilisiDate(),
        deadline: '',
        logoUrl: '',
        employmentType: '',
        facts: [],
        applicationLinks: [],
        warnings: [],
      };
      await pool.query(
        "INSERT INTO source_items(id,source_id,external_id,url) VALUES($1,'hr','99981234',$2)",
        [itemId, vacancy.url],
      );
      const sent: { url: string; type: string }[] = [];
      globalThis.fetch = async (input, init) => {
        assert.equal(typeof input, 'string');
        if (input === 'https://oauth2.googleapis.com/token') {
          // An independent connection must see the publication, proving COMMIT.
          assert.equal(
            (await pool.query('SELECT status FROM jobs')).rows[0]?.status,
            'published',
          );
          return Response.json({
            access_token: 'fake-token',
            expires_in: 3600,
          });
        }
        if (
          input ===
          'https://indexing.googleapis.com/v3/urlNotifications:publish'
        ) {
          const body = JSON.parse(init?.body as string);
          const state = (await pool.query('SELECT status FROM jobs')).rows[0]
            ?.status;
          assert.equal(
            state,
            body.type === 'URL_UPDATED' ? 'published' : 'archived',
          );
          sent.push(body);
          return Response.json({});
        }
        assert.match(input as string, /^https:\/\/jobx\.ge\/vacancies\//);
        assert.equal(
          (await pool.query('SELECT status FROM jobs')).rows[0]?.status,
          'archived',
        );
        return new Response('', { status: 404 });
      };
      assert.equal(await stageVacancy(itemId, vacancy), 'imported');
      const jobId = (
        await pool.query('SELECT job_id FROM source_items WHERE id=$1', [
          itemId,
        ])
      ).rows[0].job_id;
      assert.equal(sent.length, 1);
      assert.equal(sent[0].type, 'URL_UPDATED');
      assert.ok(sent[0].url.endsWith(jobId));
      assert.equal(await stageVacancy(itemId, vacancy), 'unchanged');
      assert.equal(sent.length, 1);
      await pool.query(
        "UPDATE source_items SET raw=jsonb_set(raw,'{deadline}','\"2000-01-01\"'::jsonb) WHERE id=$1",
        [itemId],
      );
      // Archival announces nothing and spends no budget: the sitemap and the
      // page itself already tell Google the vacancy is gone.
      assert.equal(await reconcileAndNotify(jobId), 'archived');
      assert.equal(sent.length, 1);
      await reconcileAndNotify(jobId);
      assert.equal(sent.length, 1);
      assert.equal(
        (await pool.query('SELECT requests FROM google_indexing_daily')).rows[0]
          .requests,
        1,
      );
      // Force the import transaction to fail before it can commit.
      await pool.query(
        "CREATE FUNCTION fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test rollback'; END $$",
      );
      await pool.query(
        'CREATE TRIGGER fail_audit BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION fail_audit()',
      );
      const failedItem = randomUUID();
      const failedVacancy = {
        ...vacancy,
        company: 'Rollback fixture',
        url: 'https://www.hr.ge/announcement/99981235/test',
      };
      await pool.query(
        "INSERT INTO source_items(id,source_id,external_id,url) VALUES($1,'hr','99981235',$2)",
        [failedItem, failedVacancy.url],
      );
      await assert.rejects(
        stageVacancy(failedItem, failedVacancy),
        /test rollback/,
      );
      assert.equal(
        (
          await pool.query('SELECT job_id FROM source_items WHERE id=$1', [
            failedItem,
          ])
        ).rows[0].job_id,
        null,
      );
      assert.equal(sent.length, 2);
    } finally {
      globalThis.fetch = originalFetch;
      globals.ertadPool = previousPool;
      for (const [name, value] of Object.entries({
        GOOGLE_INDEXING_CLIENT_EMAIL: previousEmail,
        GOOGLE_INDEXING_PRIVATE_KEY: previousKey,
        GOOGLE_INDEXING_DAILY_LIMIT: previousLimit,
      })) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
      await pool.end();
      await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await client.end();
    }
  },
);
