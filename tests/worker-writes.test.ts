import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { stageVacancy, discoverItems } from '../worker/importer';
import { tbilisiDate } from '../worker/adapters';
import { vacancySchema } from '../lib/vacancy-schema';
import { pendingNewItemsSql } from '../worker/new-only';
import { reconcileJob } from '../worker/automation';

void test(
  'new-only import keeps immutable snapshots, skips old dates and never resurrects completed IDs',
  { skip: process.env.RUN_DB_TESTS !== '1' },
  async () => {
    const url = new URL(process.env.DATABASE_URL!);
    assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname));
    assert.equal(url.pathname, '/ertad_test');
    const pool = new Pool({ connectionString: url.href, max: 1 });
    const globalDb = globalThis as unknown as { ertadPool?: Pool };
    const previous = globalDb.ertadPool;
    globalDb.ertadPool = pool;
    try {
      await pool.query(`
        CREATE TEMP TABLE sources (LIKE public.sources INCLUDING DEFAULTS INCLUDING INDEXES);
        ALTER TABLE sources ADD COLUMN IF NOT EXISTS repair_limit integer;
        CREATE TEMP TABLE jobs (LIKE public.jobs INCLUDING DEFAULTS INCLUDING INDEXES);
        CREATE TEMP TABLE source_items (LIKE public.source_items INCLUDING DEFAULTS INCLUDING INDEXES);
        CREATE TEMP TABLE audit_log (LIKE public.audit_log INCLUDING DEFAULTS INCLUDING IDENTITY);
        INSERT INTO sources(id,name,auto_publish) VALUES ('hr','hr.ge',true);
      `);
      await pool.query(
        "INSERT INTO source_items(id,source_id,external_id,url) VALUES($1,'hr','backlog','https://www.hr.ge/announcement/999/test')",
        [randomUUID()],
      );
      await pool.query(
        await readFile('db/migrations/033_new_only_scraping.sql', 'utf8'),
      );
      assert.equal(
        (await pool.query(pendingNewItemsSql('id'), ['hr', 20])).rowCount,
        0,
      );
      await pool.query("DELETE FROM source_items WHERE external_id='backlog'");
      const vacancy = vacancySchema.parse({
        title: 'Developer',
        salary: '',
        salaryMin: null,
        currency: '',
        salaryPeriod: '',
        mode: '',
        category: 'ტექნოლოგიები',
        company: 'New only fixture',
        city: 'თბილისი',
        description: 'Join our development team and develop applications.',
        url: 'https://www.hr.ge/announcement/123/test',
        source: 'hr.ge',
        datePosted: tbilisiDate(),
        deadline: '2099-01-01',
      });
      const id = randomUUID();
      await pool.query(
        "INSERT INTO source_items(id,source_id,external_id,url) VALUES($1,'hr','123',$2)",
        [id, vacancy.url],
      );
      assert.equal(await stageVacancy(id, vacancy), 'imported');
      const before = (await pool.query('SELECT * FROM jobs')).rows;
      const itemBefore = (await pool.query('SELECT * FROM source_items')).rows;
      assert.equal(
        await stageVacancy(id, { ...vacancy, title: 'Changed title' }),
        'unchanged',
      );
      assert.deepEqual((await pool.query('SELECT * FROM jobs')).rows, before);
      assert.deepEqual(
        (await pool.query('SELECT * FROM source_items')).rows,
        itemBefore,
      );
      assert.equal(
        await discoverItems('hr', [{ externalId: '123', url: vacancy.url }]),
        0,
      );
      assert.deepEqual(
        (await pool.query('SELECT * FROM source_items')).rows,
        itemBefore,
      );
      assert.equal(
        (await pool.query(pendingNewItemsSql('id'), ['hr', 20])).rowCount,
        0,
      );
      // No recheck-age archival: a valid saved snapshot stays public until expiry.
      await pool.query(
        "UPDATE source_items SET last_verified_at=now()-interval '20 days'",
      );
      const client = await pool.connect();
      try {
        assert.equal(await reconcileJob(client, before[0].id), 'unchanged');
      } finally {
        client.release();
      }
      // Purging a job cannot put its retained source ID back into the queue.
      await pool.query('UPDATE source_items SET job_id=NULL');
      assert.equal(
        (await pool.query(pendingNewItemsSql('id'), ['hr', 20])).rowCount,
        0,
      );
      for (const [externalId, date, outcome] of [
        ['124', '2020-01-01', 'outside_window'],
        ['125', '', 'undated'],
      ]) {
        const itemId = randomUUID();
        const v = {
          ...vacancy,
          url: `https://www.hr.ge/announcement/${externalId}/test`,
          datePosted: date,
        };
        await pool.query(
          "INSERT INTO source_items(id,source_id,external_id,url) VALUES($1,'hr',$2,$3)",
          [itemId, externalId, v.url],
        );
        assert.equal(await stageVacancy(itemId, v), outcome);
      }
      assert.equal(
        (await pool.query('SELECT count(*)::int n FROM jobs')).rows[0].n,
        1,
      );
      // Pending failures are bounded; the historical queue is excluded.
      for (const [externalId, age, failures] of [
        ['126', 0, 2],
        ['127', 0, 3],
        ['128', 4, 0],
      ])
        await pool.query(
          `INSERT INTO source_items(id,source_id,external_id,url,discovered_at,failures)
          VALUES($1,'hr',$2,$3,now()-($4*interval '1 day'),$5)`,
          [
            randomUUID(),
            externalId,
            `https://www.hr.ge/announcement/${externalId}/test`,
            age,
            failures,
          ],
        );
      assert.deepEqual(
        (await pool.query(pendingNewItemsSql('external_id'), ['hr', 20])).rows,
        [{ external_id: '126' }],
      );
    } finally {
      globalDb.ertadPool = previous;
      await pool.end();
    }
  },
);
