import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { db } from '../lib/server/db';
import { adminJobs, mutateJob } from '../lib/server/jobs';
import { fingerprint } from '../worker/adapters';
import type { Vacancy } from '../lib/types';

void test(
  'the admin sees automation state, filters by it and by source, and can hand a record back',
  { skip: process.env.RUN_DB_TESTS !== '1' },
  async () => {
    assert.equal(new URL(process.env.DATABASE_URL!).pathname, '/ertad_test');
    const marker = 'ADMINAUTO' + Date.now();
    const id = randomUUID();
    const itemId = randomUUID();
    const vacancy: Vacancy = {
      title: marker + ' მოლარე',
      company: 'ადმინის ფიქსტურა',
      city: 'თბილისი',
      category: 'გაყიდვები',
      salary: '1500 ₾ / თვე',
      salaryMin: 1500,
      currency: 'GEL',
      salaryPeriod: 'თვე',
      mode: 'ადგილზე',
      description:
        'წყაროს ტექსტი, რომელიც ავტომატურ მართვაზე დაბრუნებისას უნდა გამოქვეყნდეს.',
      url: 'https://www.hr.ge/announcement/999111/admin-fixture',
      source: 'hr.ge',
      deadline: '',
      datePosted: '',
      logoUrl: '',
      employmentType: '',
      facts: [],
      applicationLinks: [],
      warnings: [],
    };
    const edited = { ...vacancy, description: 'რედაქტორის ტექსტი.' };
    const previous = (
      await db().query("SELECT auto_publish FROM sources WHERE id='hr'")
    ).rows[0].auto_publish;
    try {
      // Handing a record back only republishes where the source itself publishes automatically.
      await db().query("UPDATE sources SET auto_publish=true WHERE id='hr'");
      await db().query(
        `INSERT INTO jobs(id,draft,published,status,fingerprint,automation_managed,automation_paused,needs_review,published_at)
         VALUES($1,$2,$2,'published',$3,false,true,true,now())`,
        [id, edited, fingerprint(vacancy)],
      );
      await db().query(
        `INSERT INTO source_items(id,source_id,external_id,url,job_id,raw,last_checked_at,last_verified_at)
         VALUES($1,'hr',$2,$3,$4,$5,now(),now())`,
        [itemId, marker, vacancy.url, id, vacancy],
      );
      const manual = await adminJobs('manual', marker, 1);
      assert.equal(
        manual.total,
        1,
        'a record taken over by an editor is listed as manual',
      );
      const job = manual.jobs[0];
      assert.equal(job.automation_managed, false);
      assert.equal(job.automation_paused, true);
      assert.equal(
        job.items[0].source_id,
        'hr',
        'the sheet shows which source stands behind the record',
      );
      assert.equal(
        (await adminJobs('all', marker, 1, 'hr')).total,
        1,
        'the source filter keeps a record fetched from that source',
      );
      assert.equal(
        (await adminJobs('all', marker, 1, 'jobs')).total,
        0,
        'and drops a record no other source supplied',
      );
      const resumed = await mutateJob({
        id,
        version: manual.jobs[0].version,
        action: 'resume-automation',
      });
      assert.equal(resumed.ok, true);
      const after = (await db().query('SELECT * FROM jobs WHERE id=$1', [id]))
        .rows[0];
      assert.equal(after.automation_managed, true);
      assert.equal(after.automation_paused, false);
      assert.equal(after.needs_review, false);
      assert.equal(
        after.published.description,
        vacancy.description,
        'the source snapshot replaces the editorial text, as the confirmation says',
      );
      assert.equal(
        (
          await db().query(
            "SELECT count(*)::int count FROM audit_log WHERE job_id=$1 AND action='automation.resumed'",
            [id],
          )
        ).rows[0].count,
        1,
        'handing a record back is recorded',
      );
      assert.equal((await adminJobs('manual', marker, 1)).total, 0);
    } finally {
      await db().query('UPDATE sources SET auto_publish=$1 WHERE id=$2', [
        previous,
        'hr',
      ]);
      await db().query('DELETE FROM audit_log WHERE job_id=$1', [id]);
      await db().query('DELETE FROM source_items WHERE id=$1', [itemId]);
      await db().query('DELETE FROM jobs WHERE id=$1', [id]);
      await db().end();
    }
  },
);
