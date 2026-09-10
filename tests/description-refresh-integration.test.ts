import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { db } from '../lib/server/db';
import { stageVacancy } from '../worker/importer';
import { reconcileRemovedRefresh } from '../worker/refresh';
import type { Vacancy } from '../lib/types';
void test(
  'requested refresh publishes complete text for old paused jobs but preserves a newer editorial change',
  { skip: process.env.RUN_DB_TESTS !== '1' },
  async () => {
    assert.equal(new URL(process.env.DATABASE_URL!).pathname, '/ertad_test');
    const ids = [randomUUID(), randomUUID()];
    const before = (
      await db().query(
        "SELECT auto_publish,enabled FROM sources WHERE id='jobs'",
      )
    ).rows[0];
    const v: Vacancy = {
      title: 'მოლარე',
      company: 'Full text fixture',
      city: 'თბილისი',
      category: 'სხვა',
      salary: '',
      salaryMin: null,
      currency: '',
      salaryPeriod: '',
      mode: '',
      description:
        'კომპანია აცხადებს ვაკანსიას მოლარის პოზიციაზე. სრული ინფორმაცია მოცემულია ბმულზე.',
      url: 'https://jobs.ge/ge/?view=jobs&id=9992341',
      source: 'jobs.ge',
      deadline: '2099-01-01',
      datePosted: '2026-09-01',
    };
    try {
      await db().query(
        "UPDATE sources SET auto_publish=true,enabled=true WHERE id='jobs'",
      );
      for (const id of ids) {
        await db().query(
          "INSERT INTO jobs(id,draft,published,status,fingerprint,automation_paused,updated_at) VALUES($1::uuid,$2,$2,'published',$1::text,true,now()-interval '1 hour')",
          [id, v],
        );
        await db().query(
          "INSERT INTO source_items(id,source_id,external_id,url,job_id,raw,refresh_requested_at) VALUES($1::uuid,'jobs',$1::text,$2,$1::uuid,$3,now())",
          [id, v.url, v],
        );
      }
      await db().query('UPDATE jobs SET updated_at=now() WHERE id=$1', [
        ids[1],
      ]);
      const next = {
        ...v,
        description:
          v.description +
          '\n\nხელფასი: 1500 ლარი თვეში.\nსრული მოვალეობები.\nბოლო პირობა უცვლელად.',
        fullTextUrl: 'https://app.helio-ai.com/apply/test',
      };
      for (const id of ids) await stageVacancy(id, next);
      const rows = (
        await db().query(
          'SELECT j.id,j.published,j.automation_paused,j.automation_managed,i.refresh_completed_at FROM jobs j JOIN source_items i ON i.job_id=j.id WHERE j.id=ANY($1::uuid[])',
          [ids],
        )
      ).rows;
      const updated = rows.find((r) => r.id === ids[0]);
      assert.equal(updated.published.description, next.description);
      assert.equal(updated.automation_paused, false);
      assert.equal(updated.automation_managed, true);
      assert.ok(updated.refresh_completed_at);
      const edited = rows.find((r) => r.id === ids[1]);
      assert.equal(edited.published.description, v.description);
      assert.equal(edited.automation_paused, true);
      await db().query(
        "UPDATE jobs SET automation_managed=false,automation_paused=true,updated_at=now()-interval '1 hour' WHERE id=$1",
        [ids[0]],
      );
      await db().query(
        "UPDATE source_items SET error='Source returned HTTP 404' WHERE id=ANY($1::uuid[])",
        [ids],
      );
      assert.equal(await reconcileRemovedRefresh(ids[0]), 'archived');
      const archived = (
        await db().query('SELECT status,published FROM jobs WHERE id=$1', [
          ids[0],
        ])
      ).rows[0];
      assert.equal(archived.published, null);
      assert.equal(await reconcileRemovedRefresh(ids[1]), 'skipped');
      assert.equal(
        (await db().query('SELECT status FROM jobs WHERE id=$1', [ids[1]]))
          .rows[0].status,
        'published',
      );
    } finally {
      await db().query('DELETE FROM audit_log WHERE job_id=ANY($1::uuid[])', [
        ids,
      ]);
      await db().query(
        'DELETE FROM source_items WHERE job_id=ANY($1::uuid[])',
        [ids],
      );
      await db().query('DELETE FROM jobs WHERE id=ANY($1::uuid[])', [ids]);
      await db().query(
        "UPDATE sources SET auto_publish=$1,enabled=$2 WHERE id='jobs'",
        [before.auto_publish, before.enabled],
      );
      await db().end();
    }
  },
);
