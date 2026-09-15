import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import {
  acquireSourceLease,
  releaseSourceLease,
  renewSourceLease,
} from '../worker/source-lease';
import { runSource } from '../worker/run';
import { refreshDescriptions } from '../worker/refresh';

void test(
  'source leases coordinate independent database connections',
  { skip: process.env.RUN_DB_TESTS !== '1' },
  async (t) => {
    const url = new URL(process.env.DATABASE_URL!);
    assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname));
    assert.equal(url.pathname, '/ertad_test');
    // TEMP tables are connection-local, so use an isolated schema to exercise
    // concurrent UPDATEs from two real connections without touching live sources.
    const schema = 'worker_leases_' + randomUUID().replaceAll('-', '');
    const pool = new Pool({
      connectionString: url.href,
      max: 2,
      options: `-c search_path=${schema}`,
    });
    const globalDb = globalThis as unknown as { ertadPool?: Pool };
    const previous = globalDb.ertadPool;
    globalDb.ertadPool = pool;
    let created = false;
    try {
      await pool.query(`CREATE SCHEMA ${schema}`);
      created = true;
      await pool.query(
        `CREATE TABLE sources (LIKE public.sources INCLUDING ALL);
        INSERT INTO sources(id,name) VALUES ('hr','hr.ge')`,
      );
      const connections = await Promise.all([pool.connect(), pool.connect()]);
      try {
        const pids = await Promise.all(
          connections.map((client) =>
            client.query('SELECT pg_backend_pid() AS pid'),
          ),
        );
        assert.notEqual(pids[0].rows[0].pid, pids[1].rows[0].pid);
      } finally {
        for (const client of connections) client.release();
      }
      const readLease = async () =>
        (
          await pool.query(
            "SELECT lease_owner,lease_until::text FROM sources WHERE id='hr'",
          )
        ).rows[0];
      t.beforeEach(async () => {
        await pool.query(
          'UPDATE sources SET lease_until=NULL,lease_owner=NULL',
        );
      });

      await t.test('exactly one parallel acquire succeeds', async () => {
        const owners = [randomUUID(), randomUUID()];
        const acquired = await Promise.all(
          owners.map((owner) => acquireSourceLease('hr', owner, 60_000)),
        );
        assert.equal(acquired.filter(Boolean).length, 1);
        assert.equal(
          (await readLease()).lease_owner,
          owners[acquired.indexOf(true)],
        );
      });

      await t.test('an expired lease can be taken by a new owner', async () => {
        const previousOwner = randomUUID();
        const owner = randomUUID();
        await pool.query(
          "UPDATE sources SET lease_owner=$1,lease_until=now()-interval '1 second' WHERE id='hr'",
          [previousOwner],
        );
        assert.equal(await acquireSourceLease('hr', owner, 60_000), true);
        const lease = await readLease();
        assert.equal(lease.lease_owner, owner);
        assert.equal(
          await renewSourceLease('hr', previousOwner, 120_000),
          false,
        );
        await releaseSourceLease('hr', previousOwner);
        assert.deepEqual(await readLease(), lease);
      });

      await t.test(
        'release clears the lease and permits another run',
        async () => {
          const owner = randomUUID();
          assert.equal(await acquireSourceLease('hr', owner, 60_000), true);
          await releaseSourceLease('hr', owner);
          assert.deepEqual(await readLease(), {
            lease_owner: null,
            lease_until: null,
          });
          assert.equal(
            await acquireSourceLease('hr', randomUUID(), 60_000),
            true,
          );
        },
      );

      await t.test(
        'renew by another owner leaves the lease unchanged',
        async () => {
          const owner = randomUUID();
          assert.equal(await acquireSourceLease('hr', owner, 60_000), true);
          const lease = await readLease();
          assert.equal(
            await renewSourceLease('hr', randomUUID(), 120_000),
            false,
          );
          assert.deepEqual(await readLease(), lease);
        },
      );

      await t.test('renew by the owner extends the expiry', async () => {
        const owner = randomUUID();
        assert.equal(await acquireSourceLease('hr', owner, 60_000), true);
        const before = await readLease();
        assert.equal(await renewSourceLease('hr', owner, 120_000), true);
        const after = await readLease();
        assert.equal(after.lease_owner, owner);
        assert.ok(
          Date.parse(after.lease_until) > Date.parse(before.lease_until),
        );
        assert.equal(
          await acquireSourceLease('hr', randomUUID(), 60_000),
          false,
        );
      });

      await t.test(
        'crawl and refresh retain skipped results while leased',
        async () => {
          assert.equal(
            await acquireSourceLease('hr', randomUUID(), 60_000),
            true,
          );
          const lease = await readLease();
          assert.deepEqual(await runSource('hr'), { skipped: true });
          assert.deepEqual(await refreshDescriptions('hr'), {
            source: 'hr',
            skipped: true,
            refreshed: 0,
            held: 0,
            failed: 0,
            removed: 0,
            remaining: 0,
          });
          assert.deepEqual(await readLease(), lease);
        },
      );
    } finally {
      globalDb.ertadPool = previous;
      try {
        if (created) {
          await pool.query(`DROP TABLE IF EXISTS ${schema}.sources`);
          await pool.query(`DROP SCHEMA ${schema}`);
        }
      } finally {
        await pool.end();
      }
    }
  },
);
