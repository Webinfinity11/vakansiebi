import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { db } from '../lib/server/db';
import { tbilisiDate } from '../worker/adapters';
import { reconcileJob } from '../worker/automation';
import { discoverItems, stageVacancy, hashVacancy } from '../worker/importer';
import type { Vacancy } from '../lib/types';
void test(
  'initial quality holds recover, completed snapshots stay immutable, and stored expiry still archives',
  { skip: process.env.RUN_DB_TESTS !== '1' },
  async () => {
    assert.equal(new URL(process.env.DATABASE_URL!).pathname, '/ertad_test');
    const external = randomUUID();
    let itemId: string | undefined;
    let jobId: string | undefined;
    const saved = (
      await db().query(
        "SELECT auto_publish,enabled,retired FROM sources WHERE id='hr'",
      )
    ).rows[0];
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
      deadline: tbilisiDate(new Date(Date.now() + 30 * 86400000)),
      datePosted: tbilisiDate(),
      logoUrl: 'https://www.hr.ge/company.png',
    };
    try {
      await db().query(
        "UPDATE sources SET auto_publish=true,enabled=true,retired=false WHERE id='hr'",
      );
      await discoverItems('hr', [{ externalId: external, url: v.url }]);
      itemId = (
        await db().query('SELECT id FROM source_items WHERE external_id=$1', [
          external,
        ])
      ).rows[0].id;
      // New-only still validates a first fetch and retries a held, unimported ID.
      const invalid = { ...v, company: '' };
      assert.equal(await stageVacancy(itemId!, invalid), 'quality_held');
      const held = (
        await db().query('SELECT * FROM source_items WHERE id=$1', [itemId])
      ).rows[0];
      assert.equal(held.job_id, null);
      assert.equal(held.raw, null);
      assert.deepEqual(held.quality_candidate, invalid);
      assert.ok(held.quality_warning);
      assert.equal(await stageVacancy(itemId!, v), 'imported');
      const old = (
        await db().query('SELECT * FROM source_items WHERE id=$1', [itemId])
      ).rows[0];
      jobId = old.job_id;
      assert.ok(jobId);
      assert.equal(old.quality_candidate, null);
      assert.equal(old.quality_warning, null);
      assert.equal(old.quality_observations, 0);
      assert.equal(old.content_hash, hashVacancy(v));
      const published = (
        await db().query('SELECT * FROM jobs WHERE id=$1', [jobId])
      ).rows[0];
      assert.equal(published.status, 'published');
      assert.equal(published.needs_review, false);

      // 64a5c0e makes completed snapshots immutable: optional-field loss no
      // longer queues a recheck or replaces the original source/public text.
      const next = { ...v, logoUrl: '' };
      assert.equal(await stageVacancy(itemId!, next), 'unchanged');
      assert.deepEqual(
        (await db().query('SELECT * FROM source_items WHERE id=$1', [itemId]))
          .rows[0],
        old,
      );
      assert.deepEqual(
        (await db().query('SELECT * FROM jobs WHERE id=$1', [jobId])).rows[0],
        published,
      );

      // Legacy quality holds may still exist. Age alone no longer archives
      // them: new-only collection has no seven-day reverification requirement.
      const client = await db().connect();
      try {
        await client.query('BEGIN');
        await client.query(
          "UPDATE source_items SET quality_candidate=$2,quality_warning='Legacy quality hold' WHERE id=$1",
          [itemId, next],
        );
        assert.equal(await reconcileJob(client, jobId!), 'quality_held');
        await client.query(
          "UPDATE source_items SET last_verified_at=now()-interval '8 days' WHERE id=$1",
          [itemId],
        );
        assert.equal(await reconcileJob(client, jobId!), 'unchanged');
        const stale = (
          await client.query('SELECT status,published FROM jobs WHERE id=$1', [
            jobId,
          ])
        ).rows[0];
        assert.equal(stale.status, 'published');
        assert.deepEqual(stale.published, published.published);
        const expired = {
          ...v,
          deadline: tbilisiDate(new Date(Date.now() - 86400000)),
        };
        await client.query('UPDATE source_items SET raw=$2 WHERE id=$1', [
          itemId,
          expired,
        ]);
        await client.query(
          'UPDATE jobs SET draft=$2,published=$2 WHERE id=$1',
          [jobId, expired],
        );
        assert.equal(await reconcileJob(client, jobId!), 'archived');
        const archived = (
          await client.query(
            'SELECT published,automation_reason FROM jobs WHERE id=$1',
            [jobId],
          )
        ).rows[0];
        assert.equal(archived.published, null);
        assert.equal(archived.automation_reason, 'expired');
      } finally {
        await client.query('ROLLBACK');
        client.release();
      }
      assert.equal(await stageVacancy(itemId!, next), 'unchanged');
      assert.deepEqual(
        (await db().query('SELECT * FROM source_items WHERE id=$1', [itemId]))
          .rows[0],
        old,
      );
    } finally {
      if (jobId)
        await db().query('DELETE FROM audit_log WHERE job_id=$1', [jobId]);
      if (itemId)
        await db().query('DELETE FROM source_items WHERE id=$1', [itemId]);
      if (jobId) await db().query('DELETE FROM jobs WHERE id=$1', [jobId]);
      await db().query(
        "UPDATE sources SET auto_publish=$1,enabled=$2,retired=$3 WHERE id='hr'",
        [saved.auto_publish, saved.enabled, saved.retired],
      );
      await db().end();
    }
  },
);
