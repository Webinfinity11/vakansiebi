import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { db } from '../lib/server/db';
import { reconcileJob } from '../worker/automation';
import { discoverItems, stageVacancy, hashVacancy } from '../worker/importer';
import type { Vacancy } from '../lib/types';
void test(
  'quality hold preserves good source/published snapshots, marks review, and confirmed optional removal can recover',
  { skip: process.env.RUN_DB_TESTS !== '1' },
  async () => {
    assert.equal(new URL(process.env.DATABASE_URL!).pathname, '/ertad_test');
    const external = randomUUID();
    let itemId: string | undefined;
    let jobId: string | undefined;
    const v: Vacancy = {
      title: 'Quality test ' + external,
      company: 'Quality Studio',
      city: 'თბილისი',
      category: 'სხვა',
      salary: '',
      salaryMin: null,
      currency: '',
      salaryPeriod: '',
      mode: '',
      description:
        'Meaningful duties and requirements for this real-shaped quality fixture. '.repeat(
          10,
        ),
      url: 'https://www.hr.ge/announcement/888999123/test',
      source: 'hr.ge',
      deadline: '2099-01-01',
      datePosted: '2026-01-01',
      logoUrl: 'https://www.hr.ge/company.png',
    };
    try {
      await discoverItems('hr', [{ externalId: external, url: v.url }]);
      itemId = (
        await db().query('SELECT id FROM source_items WHERE external_id=$1', [
          external,
        ])
      ).rows[0].id;
      await stageVacancy(itemId!, v);
      jobId = (
        await db().query('SELECT job_id FROM source_items WHERE id=$1', [
          itemId,
        ])
      ).rows[0].job_id;
      await db().query(
        "UPDATE jobs SET published=$2,status='published',automation_managed=true WHERE id=$1",
        [jobId, v],
      );
      const old = (
        await db().query(
          'SELECT raw,content_hash,last_verified_at FROM source_items WHERE id=$1',
          [itemId],
        )
      ).rows[0];
      const next = { ...v, logoUrl: '' };
      assert.equal(await stageVacancy(itemId!, next), 'quality_held');
      let row = (
        await db().query('SELECT * FROM source_items WHERE id=$1', [itemId])
      ).rows[0];
      assert.deepEqual(row.raw, old.raw);
      assert.equal(row.content_hash, old.content_hash);
      assert.equal(
        row.last_verified_at.toISOString(),
        old.last_verified_at.toISOString(),
      );
      assert.equal(row.error, null);
      assert.deepEqual(row.quality_candidate, next);
      assert.ok(row.quality_warning);
      const job = (
        await db().query(
          'SELECT published,needs_review FROM jobs WHERE id=$1',
          [jobId],
        )
      ).rows[0];
      assert.deepEqual(job.published, v);
      assert.equal(job.needs_review, false);
      const client = await db().connect();
      try {
        await client.query('BEGIN');
        await client.query(
          "UPDATE sources SET auto_publish=true,enabled=true,retired=false WHERE id='hr'",
        );
        assert.equal(await reconcileJob(client, jobId!), 'quality_held');
        await client.query(
          "UPDATE source_items SET last_verified_at=now()-interval '8 days' WHERE id=$1",
          [itemId],
        );
        assert.equal(await reconcileJob(client, jobId!), 'archived');
        const stale = (
          await client.query(
            'SELECT status,published,automation_reason FROM jobs WHERE id=$1',
            [jobId],
          )
        ).rows[0];
        assert.equal(stale.published, null);
        assert.equal(stale.automation_reason, 'unverified');
      } finally {
        await client.query('ROLLBACK');
        client.release();
      }

      assert.equal(await stageVacancy(itemId!, next), 'quality_held');
      row = (
        await db().query(
          'SELECT quality_observations FROM source_items WHERE id=$1',
          [itemId],
        )
      ).rows[0];
      assert.equal(row.quality_observations, 1);
      await db().query(
        "UPDATE source_items SET quality_first_seen=now()-interval '31 minutes',quality_last_seen=now()-interval '31 minutes' WHERE id=$1",
        [itemId],
      );
      assert.equal(await stageVacancy(itemId!, next), 'changed');
      row = (
        await db().query(
          'SELECT raw,quality_candidate,quality_warning,content_hash FROM source_items WHERE id=$1',
          [itemId],
        )
      ).rows[0];
      assert.equal(row.raw.logoUrl, '');
      assert.equal(row.quality_candidate, null);
      assert.equal(row.quality_warning, null);
      assert.equal(row.content_hash, hashVacancy(next));
    } finally {
      if (jobId)
        await db().query('DELETE FROM audit_log WHERE job_id=$1', [jobId]);
      if (itemId)
        await db().query('DELETE FROM source_items WHERE id=$1', [itemId]);
      if (jobId) await db().query('DELETE FROM jobs WHERE id=$1', [jobId]);
      await db().end();
    }
  },
);
