import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

/* A jobs.ge vacancy imported before its listing named the city and the category gets both as
   soon as the listing is read again, and automation publishes them — without a detail re-read. */
void test(
  'a late listing hint reaches the stored copy and the published vacancy',
  { skip: process.env.RUN_DB_TESTS !== '1' },
  async () => {
    assert.equal(new URL(process.env.DATABASE_URL!).pathname, '/ertad_test');
    const { db } = await import('../lib/server/db');
    const { discoverItems, stageVacancy } = await import('../worker/importer');
    const { reconcileJob } = await import('../worker/automation');
    const { transaction } = await import('../lib/server/db');
    const { parseDetail } = await import('../worker/adapters');
    const external = String(Date.now()).slice(-9);
    const url = `https://jobs.ge/ge/?view=jobs&id=${external}`;
    // Same shape as the jobs.ge detail fixture in parsers.test.ts, with a deadline far ahead.
    const html = `<table><tr><td class="dtitle"><b>Designer ${randomUUID()}</b></td><td class="dtitle"><b>Studio</b></td><td class="dtitle"><b>01 სექტემბერი</b><b>30 დეკემბერი</b></td></tr><tr><td><p>We are seeking an experienced designer to join our growing team.</p></td></tr></table>`;
    await db().query(
      "UPDATE sources SET auto_publish=true, enabled=true WHERE id='jobs'",
    );
    await discoverItems('jobs', [{ externalId: external, url }]);
    const item = (
      await db().query(
        'SELECT id FROM source_items WHERE source_id=$1 AND external_id=$2',
        ['jobs', external],
      )
    ).rows[0];
    const bare = parseDetail('jobs', html, url);
    assert.equal(
      bare.city,
      '',
      'the fixture must parse with no city, or this test proves nothing',
    );
    await stageVacancy(item.id, bare, 24);
    await db().query(
      'UPDATE source_items SET last_verified_at=now() WHERE id=$1',
      [item.id],
    );
    const jobId = (
      await db().query('SELECT job_id FROM source_items WHERE id=$1', [item.id])
    ).rows[0].job_id;
    await transaction((c) => reconcileJob(c, jobId));
    const before = (
      await db().query('SELECT status, published FROM jobs WHERE id=$1', [
        jobId,
      ])
    ).rows[0];
    assert.equal(before.published?.city ?? '', '', 'imported without a city');

    await discoverItems('jobs', [
      {
        externalId: external,
        url,
        hints: {
          city: 'ბათუმი',
          categoryLabel: 'IT/პროგრამირება',
          category: 'ტექნოლოგიები',
        },
      },
    ]);
    const stored = (
      await db().query(
        'SELECT raw, content_hash FROM source_items WHERE id=$1',
        [item.id],
      )
    ).rows[0];
    assert.equal(stored.raw.city, 'ბათუმი');
    assert.equal(stored.raw.category, 'ტექნოლოგიები');
    const queued = (
      await db().query('SELECT automation_checked_at FROM jobs WHERE id=$1', [
        jobId,
      ])
    ).rows[0];
    assert.equal(
      queued.automation_checked_at,
      null,
      'moved to the front of reconcile',
    );
    assert.equal(
      (
        await db().query(
          "SELECT count(*)::int n FROM audit_log WHERE job_id=$1 AND action='source.hints_applied'",
          [jobId],
        )
      ).rows[0].n,
      1,
    );

    await transaction((c) => reconcileJob(c, jobId));
    const after = (
      await db().query('SELECT published FROM jobs WHERE id=$1', [jobId])
    ).rows[0];
    assert.equal(
      after.published.city,
      'ბათუმი',
      'published with the city its listing named',
    );
    assert.equal(after.published.category, 'ტექნოლოგიები');

    // Reading the listing again with the same hint changes nothing further.
    await discoverItems('jobs', [
      {
        externalId: external,
        url,
        hints: {
          city: 'ბათუმი',
          categoryLabel: 'IT/პროგრამირება',
          category: 'ტექნოლოგიები',
        },
      },
    ]);
    assert.equal(
      (
        await db().query('SELECT content_hash FROM source_items WHERE id=$1', [
          item.id,
        ])
      ).rows[0].content_hash,
      stored.content_hash,
    );
    assert.equal(
      (
        await db().query(
          "SELECT count(*)::int n FROM audit_log WHERE job_id=$1 AND action='source.hints_applied'",
          [jobId],
        )
      ).rows[0].n,
      1,
      'a repeated listing is not a second change',
    );
    await db().end();
  },
);
