import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { db } from '../lib/server/db';
import { enrichExistingBatch } from '../worker/enrich-existing';
import type { Vacancy } from '../lib/types';
void test(
  'bulk enrichment preserves verification times, editorial snapshots, existing salary and publication state',
  { skip: process.env.RUN_DB_TESTS !== '1' },
  async () => {
    assert.equal(new URL(process.env.DATABASE_URL!).pathname, '/ertad_test');
    const ids = [randomUUID(), randomUUID()];
    const vacancy: Vacancy = {
      title: 'მოლარე',
      company: 'Enrichment fixture',
      city: 'თბილისი',
      category: 'გაყიდვები',
      salary: '',
      salaryMin: null,
      currency: '',
      salaryPeriod: '',
      mode: '',
      description:
        'კომპანია აცხადებს ვაკანსიას მოლარის პოზიციაზე.\nხელფასი: 1500 ლარი თვეში + ბონუსი',
      url: 'https://jobs.ge/ge/?view=jobs&id=999999',
      source: 'jobs.ge',
      deadline: '2099-01-01',
      datePosted: '2026-09-01',
      facts: [],
    };
    try {
      for (let i = 0; i < ids.length; i++) {
        await db().query(
          "INSERT INTO jobs(id,draft,published,status,fingerprint,automation_managed,published_at) VALUES($1::uuid,$2,$2,'published',$1::text,$3,'2026-09-01T00:00:00Z')",
          [ids[i], vacancy, i === 0],
        );
        await db().query(
          "INSERT INTO source_items(id,job_id,source_id,external_id,url,raw,last_checked_at,last_verified_at,next_check_at) VALUES($1::uuid,$1::uuid,'jobs',$1::text,$2,$3,'2026-09-01T00:00:00Z','2026-09-01T00:00:00Z','2026-09-11T00:00:00Z')",
          [ids[i], vacancy.url, vacancy],
        );
      }
      assert.equal((await enrichExistingBatch(ids)).salaryFilled, 1);
      assert.equal(
        (await db().query('SELECT published FROM jobs WHERE id=$1', [ids[0]]))
          .rows[0].published.salary,
        '',
      );
      const result = await enrichExistingBatch(ids, true);
      assert.equal(result.salaryFilled, 1);
      const rows = (
        await db().query(
          'SELECT j.id,j.published,j.status,j.published_at,i.last_verified_at,i.last_checked_at,i.next_check_at FROM jobs j JOIN source_items i ON i.job_id=j.id WHERE j.id=ANY($1::uuid[])',
          [ids],
        )
      ).rows;
      for (const row of rows) {
        assert.equal(row.status, 'published');
        assert.equal(
          row.last_checked_at.toISOString().slice(0, 10),
          '2026-09-01',
        );
        assert.equal(
          row.last_verified_at.toISOString().slice(0, 10),
          '2026-09-01',
        );
        assert.equal(
          row.next_check_at.toISOString().slice(0, 10),
          '2026-09-11',
        );
        assert.equal(row.published_at.toISOString().slice(0, 10), '2026-09-01');
        assert.equal(
          row.published.salary,
          row.id === ids[0] ? '1500 ლარი თვეში + ბონუსი' : '',
        );
      }
      assert.equal((await enrichExistingBatch(ids, true)).jobs, 0);
      await db().query('UPDATE jobs SET automation_paused=true WHERE id=$1', [
        ids[1],
      ]);
      assert.equal((await enrichExistingBatch(ids, true)).jobs, 0);
      assert.equal(
        (await enrichExistingBatch(ids, true, true)).salaryFilled,
        1,
      );
      const editorial = (
        await db().query(
          'SELECT automation_managed,automation_paused,published FROM jobs WHERE id=$1',
          [ids[1]],
        )
      ).rows[0];
      assert.equal(editorial.automation_managed, false);
      assert.equal(editorial.automation_paused, true);
      assert.equal(editorial.published.salary, '1500 ლარი თვეში + ბონუსი');
      assert.equal((await enrichExistingBatch(ids, true, true)).jobs, 0);
    } finally {
      await db().query('DELETE FROM audit_log WHERE job_id=ANY($1::uuid[])', [
        ids,
      ]);
      await db().query(
        'DELETE FROM source_items WHERE job_id=ANY($1::uuid[])',
        [ids],
      );
      await db().query('DELETE FROM jobs WHERE id=ANY($1::uuid[])', [ids]);
      await db().end();
    }
  },
);
