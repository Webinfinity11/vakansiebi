import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Client, Pool } from 'pg';
import { indexingTransition } from '../lib/server/google-indexing';
import {
  drainIndexingQueue,
  enqueueIndexingNotifications,
} from '../lib/server/indexing-queue';
import type { Vacancy } from '../lib/types';

void test(
  'persisted indexing delivery survives rollback, missing credentials, failures and concurrent edits',
  { skip: process.env.RUN_DB_TESTS !== '1' },
  async (t) => {
    const database = new URL(process.env.DATABASE_URL!);
    assert.ok(['localhost', '127.0.0.1'].includes(database.hostname));
    assert.equal(database.pathname, '/ertad_test');
    const schema = 'indexing_queue_' + randomUUID().replaceAll('-', '');
    const client = new Client({ connectionString: database.href });
    await client.connect();
    const pool = new Pool({
      connectionString: database.href,
      options: `-c search_path=${schema}`,
      max: 6,
    });
    const settings = {
      GOOGLE_INDEXING_CLIENT_EMAIL: 'fixture@example.invalid',
      GOOGLE_INDEXING_PRIVATE_KEY: 'injected-sender',
    };
    const vacancy: Vacancy = {
      title: 'Developer',
      company: 'Queue fixture',
      city: 'თბილისი',
      category: 'ტექნოლოგიები',
      salary: '',
      salaryMin: null,
      currency: '',
      salaryPeriod: '',
      mode: '',
      description:
        'Join our experienced development team and create useful products.',
      url: 'https://www.hr.ge/announcement/99981236/test',
      source: 'hr.ge',
      datePosted: new Date().toLocaleDateString('en-CA', {
        timeZone: 'Asia/Tbilisi',
      }),
      deadline: '',
    };
    const id = randomUUID();
    const events = indexingTransition(
      id,
      { status: 'pending', published: null },
      { status: 'published', published: vacancy },
    );
    assert.equal(events.length, 1);
    const queue = async () =>
      (await pool.query('SELECT * FROM google_indexing_queue')).rows[0];
    const reset = async () => {
      await pool.query('TRUNCATE google_indexing_queue');
      await pool.query("UPDATE jobs SET status='published',published=$1", [
        vacancy,
      ]);
      await enqueueIndexingNotifications(events, pool);
    };
    try {
      await client.query(`CREATE SCHEMA ${schema}`);
      await client.query(`SET search_path TO ${schema}`);
      await client.query(
        'CREATE TABLE jobs(id uuid PRIMARY KEY,status text,published jsonb,is_test boolean DEFAULT false)',
      );
      await client.query(
        'CREATE TABLE job_submissions(job_id uuid,is_test boolean DEFAULT false)',
      );
      await client.query(
        readFileSync('db/migrations/037_google_indexing_daily.sql', 'utf8'),
      );
      const migration = readFileSync(
        'db/migrations/050_google_indexing_queue.sql',
        'utf8',
      );
      await client.query(migration);
      await client.query(migration);
      await pool.query(
        "INSERT INTO jobs(id,status,published) VALUES($1,'published',$2)",
        [id, vacancy],
      );
      await t.test(
        'rollback leaves no notification; publishers without credentials keep committed notifications',
        async () => {
          await client.query('BEGIN');
          await enqueueIndexingNotifications(events, client);
          await client.query('ROLLBACK');
          assert.equal(
            (
              await pool.query(
                'SELECT count(*)::int AS n FROM google_indexing_queue',
              )
            ).rows[0].n,
            0,
          );
          await enqueueIndexingNotifications(events, pool);
          const result = await drainIndexingQueue({
            connection: pool,
            settings: {},
            send: async () => assert.fail('credentials unavailable'),
          });
          assert.equal(result.disabled, true);
          assert.equal((await queue()).status, 'pending');
          assert.equal((await queue()).attempts, 0);
        },
      );
      await t.test(
        'temporary failure is retained and a later attempt succeeds without duplicate enqueue',
        async () => {
          await reset();
          let calls = 0;
          const first = await drainIndexingQueue({
            connection: pool,
            settings,
            send: async () => {
              calls++;
              return { status: 'failed', httpStatus: 503, reason: 'http-503' };
            },
          });
          assert.equal(first.retried, 1);
          assert.equal((await queue()).status, 'pending');
          assert.equal((await queue()).attempts, 1);
          assert.ok(
            new Date((await queue()).available_at).getTime() > Date.now(),
          );
          await enqueueIndexingNotifications(events, pool);
          assert.equal((await queue()).attempts, 1);
          await pool.query(
            "UPDATE google_indexing_queue SET available_at=now()-interval '1 second'",
          );
          const retry = await drainIndexingQueue({
            connection: pool,
            settings,
            send: async () => {
              calls++;
              return { status: 'sent', httpStatus: 200 };
            },
          });
          assert.equal(retry.sent, 1);
          assert.equal((await queue()).status, 'sent');
          assert.equal((await queue()).attempts, 2);
          await enqueueIndexingNotifications(events, pool);
          await drainIndexingQueue({
            connection: pool,
            settings,
            send: async () => assert.fail('already accepted'),
          });
          assert.equal(calls, 2);
        },
      );
      await t.test(
        'quota deferral preserves the event until the next Pacific day without counting an attempt',
        async () => {
          await reset();
          const result = await drainIndexingQueue({
            connection: pool,
            settings,
            send: async () => ({ status: 'deferred', reason: 'daily-budget' }),
          });
          assert.equal(result.deferred, 1);
          assert.equal((await queue()).status, 'pending');
          assert.equal((await queue()).attempts, 0);
          assert.equal(
            (
              await pool.query(
                "SELECT available_at AT TIME ZONE 'America/Los_Angeles' = ((now() AT TIME ZONE 'America/Los_Angeles')::date+1)::timestamp AS next_day FROM google_indexing_queue",
              )
            ).rows[0].next_day,
            true,
          );
        },
      );
      await t.test('parallel workers lease a notification once', async () => {
        await reset();
        let entered!: () => void;
        let release!: () => void;
        const started = new Promise<void>((resolve) => {
          entered = resolve;
        });
        const blocked = new Promise<void>((resolve) => {
          release = resolve;
        });
        let calls = 0;
        const first = drainIndexingQueue({
          connection: pool,
          settings,
          limit: 1,
          send: async () => {
            calls++;
            entered();
            await blocked;
            return { status: 'sent' };
          },
        });
        await started;
        const second = await drainIndexingQueue({
          connection: pool,
          settings,
          limit: 1,
          send: async () => {
            calls++;
            return { status: 'sent' };
          },
        });
        release();
        await first;
        assert.equal(second.sent, 0);
        assert.equal(calls, 1);
      });
      await t.test(
        'an old in-flight response cannot mark a newly edited revision as delivered',
        async () => {
          await reset();
          const changed = {
            ...vacancy,
            description: vacancy.description + ' Now hiring for a senior role.',
          };
          const revision = indexingTransition(
            id,
            { status: 'published', published: vacancy },
            { status: 'published', published: changed },
          );
          await drainIndexingQueue({
            connection: pool,
            settings,
            limit: 1,
            send: async () => {
              await pool.query('UPDATE jobs SET published=$1 WHERE id=$2', [
                changed,
                id,
              ]);
              await enqueueIndexingNotifications(revision, pool);
              return { status: 'sent' };
            },
          });
          assert.equal((await queue()).status, 'pending');
          assert.equal((await queue()).content_hash, revision[0].contentHash);
          assert.equal((await queue()).sent_at, null);
          await drainIndexingQueue({
            connection: pool,
            settings,
            send: async () => ({ status: 'sent' }),
          });
          assert.equal((await queue()).status, 'sent');
        },
      );
      await t.test(
        'an expired, archived or unsupported posting is cancelled without using API quota',
        async () => {
          for (const published of [
            { ...vacancy, deadline: '2000-01-01' },
            { ...vacancy, company: '' },
            vacancy,
          ]) {
            await reset();
            await pool.query('UPDATE jobs SET published=$1,status=$2', [
              published,
              published === vacancy ? 'archived' : 'published',
            ]);
            const result = await drainIndexingQueue({
              connection: pool,
              settings,
              send: async () => assert.fail('unavailable job announced'),
            });
            assert.equal(result.cancelled, 1);
            assert.equal((await queue()).attempts, 0);
          }
        },
      );
      await t.test(
        'service authorization failures stop a batch and permanent request failures remain visible',
        async () => {
          await reset();
          const otherId = randomUUID();
          await pool.query(
            "INSERT INTO jobs(id,status,published) VALUES($1,'published',$2)",
            [otherId, vacancy],
          );
          await enqueueIndexingNotifications(
            indexingTransition(
              otherId,
              { status: 'pending', published: null },
              { status: 'published', published: vacancy },
            ),
            pool,
          );
          let calls = 0;
          const failure = await drainIndexingQueue({
            connection: pool,
            settings,
            send: async () => {
              calls++;
              return { status: 'failed', httpStatus: 403, reason: 'http-403' };
            },
          });
          assert.equal(failure.retried, 1);
          assert.equal(calls, 1);
          await pool.query(
            "UPDATE google_indexing_queue SET available_at=now()-interval '1 second'",
          );
          const rejected = await drainIndexingQueue({
            connection: pool,
            settings,
            send: async () => ({
              status: 'failed',
              httpStatus: 400,
              reason: 'http-400',
            }),
          });
          assert.equal(rejected.rejected, 2);
          assert.equal(
            (
              await pool.query(
                "SELECT count(*)::int AS n FROM google_indexing_queue WHERE status='rejected'",
              )
            ).rows[0].n,
            2,
          );
        },
      );
    } finally {
      await pool.end();
      await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await client.end();
    }
  },
);
