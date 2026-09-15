import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { stageVacancy, hashVacancy } from '../worker/importer';
import { fingerprint } from '../worker/adapters';
import { vacancySchema } from '../lib/vacancy-schema';

void test(
  'successful rechecks clear quality with freshness in one update and preserve unchanged TOAST values',
  { skip: process.env.RUN_DB_TESTS !== '1' },
  async () => {
    const url = new URL(process.env.DATABASE_URL!);
    assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname));
    assert.equal(url.pathname, '/ertad_test');
    // A single connection keeps temporary tables visible to stageVacancy's
    // real transaction helper. Other processes and permanent fixtures are untouched.
    const pool = new Pool({ connectionString: url.href, max: 1 });
    const globalDb = globalThis as unknown as { ertadPool?: Pool };
    const previous = globalDb.ertadPool;
    const id = randomUUID();
    const vacancy = vacancySchema.parse({
      title: 'Developer',
      company: 'Worker write fixture',
      city: 'თბილისი',
      salary: '',
      salaryMin: null,
      currency: '',
      salaryPeriod: '',
      mode: '',
      category: 'ტექნოლოგიები',
      // Incompressible enough to exercise external TOAST storage, not just an
      // inline JSON value that would hide repeated large-payload writes.
      description:
        'Join our development team. ' + randomBytes(18000).toString('hex'),
      url: 'https://www.hr.ge/announcement/123/test',
      source: 'hr.ge',
      datePosted: '2026-09-01',
      deadline: '2099-01-01',
    });
    globalDb.ertadPool = pool;
    try {
      await pool.query(`
        CREATE TEMP TABLE sources (LIKE public.sources INCLUDING DEFAULTS);
        CREATE TEMP TABLE jobs (LIKE public.jobs INCLUDING DEFAULTS);
        CREATE TEMP TABLE source_items (LIKE public.source_items INCLUDING DEFAULTS);
        CREATE TEMP TABLE audit_log (LIKE public.audit_log INCLUDING DEFAULTS INCLUDING IDENTITY);
        CREATE TEMP TABLE write_count (n integer);
        INSERT INTO write_count VALUES (0);
        CREATE FUNCTION pg_temp.count_item_writes() RETURNS trigger LANGUAGE plpgsql AS $$
          BEGIN UPDATE write_count SET n=n+1; RETURN NEW; END $$;
        CREATE TRIGGER count_item_writes AFTER UPDATE ON source_items
          FOR EACH ROW EXECUTE FUNCTION pg_temp.count_item_writes();
        INSERT INTO sources(id,name,auto_publish) VALUES ('hr','hr.ge',true);
      `);
      await pool.query(
        `INSERT INTO jobs(id,draft,published,status,fingerprint,automation_managed,needs_review,updated_at)
        VALUES ($1,$2,$2,'published',$3,true,false,now()-interval '1 day')`,
        [id, vacancy, fingerprint(vacancy)],
      );
      await pool.query(
        `INSERT INTO source_items(id,source_id,external_id,url,job_id,raw,content_hash,last_checked_at,last_verified_at)
        VALUES ($1,'hr','123',$2,$1,$3,$4,now()-interval '1 day',now()-interval '1 day')`,
        [id, vacancy.url, vacancy, hashVacancy(vacancy)],
      );
      const before = (
        await pool.query('SELECT updated_at,version,published FROM jobs')
      ).rows[0];
      const toastTable = (
        await pool.query(
          "SELECT reltoastrelid::regclass::text name FROM pg_class WHERE oid='source_items'::regclass",
        )
      ).rows[0].name;
      const toastChunks = async () =>
        (
          await pool.query(
            `SELECT chunk_id::text,chunk_seq,md5(chunk_data) hash FROM ${toastTable} ORDER BY chunk_id,chunk_seq`,
          )
        ).rows;
      const beforeToast = await toastChunks();
      assert.ok(beforeToast.length > 1, 'fixture is stored outside the heap');
      assert.equal(await stageVacancy(id, vacancy), 'unchanged');
      assert.deepEqual(
        await toastChunks(),
        beforeToast,
        'identical JSON keeps the existing TOAST chunks',
      );
      assert.equal(
        (await pool.query('SELECT n FROM write_count')).rows[0].n,
        1,
        'only the necessary freshness update writes a tuple',
      );
      const fresh = (
        await pool.query(
          'SELECT last_checked_at,last_verified_at,next_check_at FROM source_items',
        )
      ).rows[0];
      assert.ok(fresh.last_checked_at > before.updated_at);
      assert.ok(fresh.last_verified_at > before.updated_at);
      assert.ok(fresh.next_check_at > fresh.last_checked_at);
      assert.deepEqual(
        (await pool.query('SELECT updated_at,version,published FROM jobs'))
          .rows[0],
        before,
      );
      assert.equal(
        (await pool.query('SELECT count(*)::int n FROM audit_log')).rows[0].n,
        0,
      );

      // Even partially populated historical quality state must still be cleared.
      for (const residual of [
        "quality_candidate='{}'::jsonb",
        "quality_signature='previous'",
        "quality_warning='previous'",
        'quality_first_seen=now()',
        'quality_last_seen=now()',
        'quality_observations=1',
      ]) {
        await pool.query(
          `UPDATE source_items SET ${residual},last_checked_at=now()-interval '1 day'`,
        );
        await pool.query('UPDATE write_count SET n=0');
        assert.equal(await stageVacancy(id, vacancy), 'unchanged');
        assert.equal(
          (await pool.query('SELECT n FROM write_count')).rows[0].n,
          1,
          residual,
        );
        assert.deepEqual(
          (
            await pool.query(`SELECT quality_candidate,quality_signature,quality_warning,
          quality_first_seen,quality_last_seen,quality_observations FROM source_items`)
          ).rows[0],
          {
            quality_candidate: null,
            quality_signature: null,
            quality_warning: null,
            quality_first_seen: null,
            quality_last_seen: null,
            quality_observations: 0,
          },
        );
      }
      assert.deepEqual(
        (await pool.query('SELECT updated_at,version,published FROM jobs'))
          .rows[0],
        before,
      );
      assert.equal(
        (await pool.query('SELECT count(*)::int n FROM audit_log')).rows[0].n,
        0,
      );
      assert.deepEqual(
        await toastChunks(),
        beforeToast,
        'quality recovery does not rewrite unchanged raw',
      );

      const changed = {
        ...vacancy,
        description: vacancy.description + '\nNew application instructions.',
      };
      assert.equal(await stageVacancy(id, changed), 'changed');
      assert.notDeepEqual(
        await toastChunks(),
        beforeToast,
        'a real payload change is stored',
      );
      assert.deepEqual(
        (await pool.query('SELECT raw FROM source_items')).rows[0].raw,
        changed,
      );
      assert.equal(
        (await pool.query('SELECT count(*)::int n FROM audit_log')).rows[0].n,
        2,
        'source and publication changes remain audited',
      );

      // The early-return path for an unlinked expired vacancy must also clear
      // quality once while retaining its source snapshot and seven-day retry.
      const expiredId = randomUUID();
      const expired = {
        ...vacancy,
        url: 'https://www.hr.ge/announcement/124/test',
        deadline: '2000-01-01',
        datePosted: '1999-12-01',
      };
      await pool.query(
        `INSERT INTO source_items(id,source_id,external_id,url,raw,content_hash,quality_warning,quality_observations)
        VALUES ($1,'hr','124',$2,$3,$4,'previous',1)`,
        [expiredId, expired.url, expired, hashVacancy(expired)],
      );
      await pool.query('UPDATE write_count SET n=0');
      const expiredToast = await toastChunks();
      assert.equal(await stageVacancy(expiredId, expired), 'expired');
      assert.equal(
        (await pool.query('SELECT n FROM write_count')).rows[0].n,
        1,
      );
      assert.deepEqual(await toastChunks(), expiredToast);
      const expiredRow = (
        await pool.query(
          `SELECT job_id,quality_warning,quality_observations,last_checked_at,
        extract(epoch FROM next_check_at-last_checked_at)::int retry_seconds FROM source_items WHERE id=$1`,
          [expiredId],
        )
      ).rows[0];
      assert.equal(expiredRow.job_id, null);
      assert.equal(expiredRow.quality_warning, null);
      assert.equal(expiredRow.quality_observations, 0);
      assert.ok(expiredRow.last_checked_at);
      assert.equal(expiredRow.retry_seconds, 7 * 86400);
    } finally {
      globalDb.ertadPool = previous;
      await pool.end();
    }
  },
);
