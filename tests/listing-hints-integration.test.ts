import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

/* Since 64a5c0e, listing hints apply only on first import. Known IDs and their
   snapshots remain immutable (docs/new-only-scraping.md). */
void test(
  'initial listing hints publish, while late hints leave known vacancies untouched',
  { skip: process.env.RUN_DB_TESTS !== '1' },
  async () => {
    assert.equal(new URL(process.env.DATABASE_URL!).pathname, '/ertad_test');
    const { db } = await import('../lib/server/db');
    const { discoverItems, stageVacancy } = await import('../worker/importer');
    const { reconcileJob } = await import('../worker/automation');
    const { transaction } = await import('../lib/server/db');
    const { parseDetail, tbilisiDate } = await import('../worker/adapters');
    const external = String(Date.now()).slice(-9);
    const url = `https://jobs.ge/ge/?view=jobs&id=${external}`;
    const date = (days: number) => {
      const parts = new Intl.DateTimeFormat('ka-GE', {
        timeZone: 'Asia/Tbilisi',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).formatToParts(new Date(Date.now() + days * 86400000));
      return ['day', 'month', 'year']
        .map((type) => parts.find((part) => part.type === type)!.value)
        .join(' ');
    };
    const html = `<table><tr><td class="dtitle"><b>Designer ${randomUUID()}</b></td><td class="dtitle"><b>Studio</b></td><td class="dtitle"><b>${date(0)}</b><b>${date(30)}</b></td></tr><tr><td><p>We are seeking an experienced designer to join our growing team.</p></td></tr></table>`;
    // Other integration tests share this database and expect the source as the migrations left it.
    const saved = (
      await db().query(
        "SELECT auto_publish, enabled FROM sources WHERE id='jobs'",
      )
    ).rows[0];
    let jobId: string | undefined;
    let hintedJobId: string | undefined;
    const hintedExternal = external + '1';
    await db().query(
      "UPDATE sources SET auto_publish=true, enabled=true WHERE id='jobs'",
    );
    try {
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
      assert.equal(bare.datePosted, tbilisiDate());
      assert.equal(await stageVacancy(item.id, bare, 24), 'imported');
      await db().query(
        'UPDATE source_items SET last_verified_at=now() WHERE id=$1',
        [item.id],
      );
      jobId = (
        await db().query('SELECT job_id FROM source_items WHERE id=$1', [
          item.id,
        ])
      ).rows[0].job_id;
      await transaction((c) => reconcileJob(c, jobId!));
      const before = (
        await db().query(
          'SELECT status, published, automation_checked_at FROM jobs WHERE id=$1',
          [jobId],
        )
      ).rows[0];
      assert.equal(before.status, 'published');
      assert.equal(before.published.city, '', 'imported without a city');

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
      assert.deepEqual(stored.raw, bare);
      const queued = (
        await db().query('SELECT automation_checked_at FROM jobs WHERE id=$1', [
          jobId,
        ])
      ).rows[0];
      assert.equal(
        queued.automation_checked_at.getTime(),
        before.automation_checked_at.getTime(),
        'late hints do not queue a rewrite',
      );
      assert.equal(
        (
          await db().query(
            "SELECT count(*)::int n FROM audit_log WHERE job_id=$1 AND action='source.hints_applied'",
            [jobId],
          )
        ).rows[0].n,
        0,
      );

      await transaction((c) => reconcileJob(c, jobId!));
      const after = (
        await db().query('SELECT published FROM jobs WHERE id=$1', [jobId])
      ).rows[0];
      assert.deepEqual(after.published, before.published);

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
          await db().query(
            'SELECT content_hash FROM source_items WHERE id=$1',
            [item.id],
          )
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
        0,
        'repeated listings do not rewrite stored snapshots',
      );
      // New IDs still receive the listing's city/category during their first parse.
      const hints = {
        city: 'ბათუმი',
        categoryLabel: 'IT/პროგრამირება',
        category: 'ტექნოლოგიები',
      };
      const hintedUrl = `https://jobs.ge/ge/?view=jobs&id=${hintedExternal}`;
      await discoverItems('jobs', [
        { externalId: hintedExternal, url: hintedUrl, hints },
      ]);
      const hinted = (
        await db().query(
          "SELECT id,listing_hints FROM source_items WHERE source_id='jobs' AND external_id=$1",
          [hintedExternal],
        )
      ).rows[0];
      const initial = parseDetail(
        'jobs',
        html,
        hintedUrl,
        hinted.listing_hints,
      );
      assert.equal(await stageVacancy(hinted.id, initial), 'imported');
      const published = (
        await db().query(
          'SELECT j.id,j.published FROM jobs j JOIN source_items i ON i.job_id=j.id WHERE i.id=$1',
          [hinted.id],
        )
      ).rows[0];
      hintedJobId = published.id;
      assert.equal(published.published.city, 'ბათუმი');
      assert.equal(published.published.category, 'ტექნოლოგიები');
    } finally {
      const ids = [jobId, hintedJobId].filter(Boolean);
      await db().query('DELETE FROM audit_log WHERE job_id=ANY($1::uuid[])', [
        ids,
      ]);
      await db().query(
        "DELETE FROM source_items WHERE source_id='jobs' AND external_id=ANY($1::text[])",
        [[external, hintedExternal]],
      );
      await db().query('DELETE FROM jobs WHERE id=ANY($1::uuid[])', [ids]);
      await db().query(
        "UPDATE sources SET auto_publish=$1, enabled=$2 WHERE id='jobs'",
        [saved.auto_publish, saved.enabled],
      );
      await db().end();
    }
  },
);
