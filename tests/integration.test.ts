import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { Client, Pool } from 'pg';
import { tbilisiDate } from '../worker/adapters';
import { db, transaction } from '../lib/server/db';
import { reconcileJob } from '../worker/automation';
import { runSource } from '../worker/run';
import { discoverItems, stageVacancy } from '../worker/importer';
import {
  mutateJob,
  publicJobs,
  clearPublicJobsCache,
  bulkPublishCandidates,
  bulkPublishJobs,
} from '../lib/server/jobs';
import { getCompany, saveCompany } from '../lib/server/companies';
import type { Vacancy } from '../lib/types';
const enabled = process.env.RUN_DB_TESTS === '1';
void test(
  'moderation preserves public snapshot, detects conflicts, merges provenance and excludes expired jobs',
  { skip: !enabled },
  async (t) => {
    // Only a separate database explicitly named ertad_test may be mutated by this test.
    const connection = new URL(process.env.DATABASE_URL!);
    assert.equal(connection.pathname, '/ertad_test');
    assert.ok(['localhost', '127.0.0.1'].includes(connection.hostname));
    // Isolate records and source settings so retries never depend on a prior run.
    const schema = 'moderation_' + randomUUID().replaceAll('-', '');
    const client = new Client({ connectionString: connection.href });
    const pool = new Pool({
      connectionString: connection.href,
      options: `-c search_path=${schema}`,
    });
    const globals = globalThis as unknown as { ertadPool?: Pool };
    const previousPool = globals.ertadPool;
    await client.connect();
    t.after(async () => {
      globals.ertadPool = previousPool;
      clearPublicJobsCache();
      await pool.end();
      await client.query('SET search_path TO public');
      await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await client.end();
    });
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(`SET search_path TO ${schema}`);
    for (const name of readdirSync('db/migrations')
      .filter((name) => name.endsWith('.sql'))
      .sort())
      await client.query(readFileSync('db/migrations/' + name, 'utf8'));
    globals.ertadPool = pool;
    await db().query(
      "INSERT INTO sources(id,name) VALUES('hr','hr.ge'),('jobs','jobs.ge'),('hrgov','hr.gov.ge') ON CONFLICT(id) DO UPDATE SET enabled=true,retired=false,auto_publish=false",
    );
    const day = (offset: number) =>
      tbilisiDate(new Date(Date.now() + offset * 86400000));
    const georgianDay = (offset: number) => {
      const parts = new Intl.DateTimeFormat('ka-GE', {
        timeZone: 'Asia/Tbilisi',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).formatToParts(new Date(Date.now() + offset * 86400000));
      return ['day', 'month', 'year']
        .map((type) => parts.find((part) => part.type === type)!.value)
        .join(' ');
    };
    const external = randomUUID();
    const v: Vacancy = {
      title: 'TEST-' + external,
      company: 'Test Company',
      city: 'თბილისი',
      category: 'ტექნოლოგიები',
      salary: '1000 GEL / თვე',
      salaryMin: 1000,
      currency: 'GEL',
      salaryPeriod: 'თვე',
      mode: 'დისტანციური',
      description:
        'This is a dedicated integration test record, never a real vacancy.',
      url: 'https://www.hr.ge/announcement/999999999/test',
      source: 'hr.ge',
      deadline: day(30),
      datePosted: day(0),
    };
    await discoverItems('hr', [{ externalId: external, url: v.url }]);
    const item = (
      await db().query('SELECT id FROM source_items WHERE external_id=$1', [
        external,
      ])
    ).rows[0];
    assert.equal(await stageVacancy(item.id, v), 'imported');
    assert.equal(await stageVacancy(item.id, v), 'unchanged');
    let job = (
      await db().query(
        'SELECT j.* FROM jobs j JOIN source_items i ON i.job_id=j.id WHERE i.id=$1',
        [item.id],
      )
    ).rows[0];
    const params = new URLSearchParams({ q: external });
    assert.equal((await publicJobs(params)).total, 0);
    assert.equal(
      (await publicJobs(new URLSearchParams({ ids: job.id }))).total,
      0,
      'shared and saved links cannot expose an unpublished vacancy',
    );
    assert.equal((await publicJobs(params, true)).total, 1);
    const candidates = await bulkPublishCandidates();
    assert.ok(candidates.some((item) => item.id === job.id));
    const conflict = await bulkPublishJobs([
      { id: job.id, version: job.version - 1 },
    ]);
    assert.equal(conflict.results[0].published, false);
    const batch = await bulkPublishJobs([{ id: job.id, version: job.version }]);
    assert.equal(batch.results[0].published, true);
    job = (await db().query('SELECT * FROM jobs WHERE id=$1', [job.id]))
      .rows[0];
    const retry = await bulkPublishJobs([{ id: job.id, version: job.version }]);
    assert.equal(
      retry.results[0].published,
      false,
      'bulk approval cannot republish existing jobs',
    );
    assert.ok(
      !(await bulkPublishCandidates()).some((item) => item.id === job.id),
    );
    await assert.rejects(() =>
      bulkPublishJobs(
        Array.from({ length: 21 }, () => ({
          id: job.id,
          version: job.version,
        })),
      ),
    );
    const edited = { ...v, title: v.title + ' edited' };
    await mutateJob({
      id: job.id,
      version: job.version,
      action: 'publish',
      draft: edited,
    });
    assert.equal((await publicJobs(params)).jobs[0].title, edited.title);
    const profile = await getCompany(edited.company);
    await saveCompany({
      ...profile,
      website: 'https://example.com/',
      logoUrl: 'https://www.hr.ge/test-logo.png',
      description: 'Verified company profile',
    });
    // This checks database projection, not the public list's bounded cache TTL.
    clearPublicJobsCache();
    assert.equal(
      (await publicJobs(params)).jobs[0].companyProfile.website,
      'https://example.com/',
    );
    await assert.rejects(
      () => saveCompany({ ...profile, website: 'https://example.com/' }),
      /შეიცვალა/,
    );
    await assert.rejects(() =>
      saveCompany({ ...profile, logoUrl: 'javascript:alert(1)' }),
    );
    assert.equal(
      (await publicJobs(new URLSearchParams({ ids: job.id }))).jobs[0].id,
      job.id,
    );
    assert.equal(
      (await publicJobs(new URLSearchParams({ ids: '' }))).total,
      0,
      'empty saved collection must stay empty',
    );
    assert.equal(
      (await publicJobs(new URLSearchParams({ ids: "invalid,' OR true --" })))
        .total,
      0,
    );
    // 64a5c0e: completed IDs never rewrite snapshots or create review tasks.
    assert.equal(
      await stageVacancy(item.id, {
        ...v,
        title: v.title + ' source changed',
      }),
      'unchanged',
    );
    job = (await db().query('SELECT * FROM jobs WHERE id=$1', [job.id]))
      .rows[0];
    assert.equal(job.draft.title, edited.title);
    assert.equal((await publicJobs(params)).jobs[0].sourceChanged, false);
    assert.equal(job.published.title, edited.title);
    assert.equal(job.needs_review, false);
    await assert.rejects(
      () =>
        mutateJob({
          id: job.id,
          version: job.version - 1,
          action: 'archive',
        }),
      /შეიცვალა/,
    );
    const revised = { ...edited, company: 'Edited Company' };
    await mutateJob({
      id: job.id,
      version: job.version,
      action: 'save',
      draft: revised,
    });
    assert.equal((await publicJobs(params)).jobs[0].company, 'Test Company');
    const external2 = randomUUID();
    await discoverItems('jobs', [
      {
        externalId: external2,
        url: 'https://jobs.ge/ge/?view=jobs&id=999999999',
      },
    ]);
    const item2 = (
      await db().query('SELECT * FROM source_items WHERE external_id=$1', [
        external2,
      ])
    ).rows[0];
    await stageVacancy(item2.id, {
      ...v,
      source: 'jobs.ge',
      url: item2.url,
    });
    const other = (
      await db().query(
        'SELECT j.* FROM jobs j JOIN source_items i ON i.job_id=j.id WHERE i.id=$1',
        [item2.id],
      )
    ).rows[0];
    await mutateJob({
      id: other.id,
      version: other.version,
      action: 'merge',
      targetId: job.id,
    });
    assert.equal((await publicJobs(params)).jobs[0].sources.length, 2);
    assert.equal((await publicJobs(params)).total, 1);
    job = (await db().query('SELECT * FROM jobs WHERE id=$1', [job.id]))
      .rows[0];
    await mutateJob({ id: job.id, version: job.version, action: 'archive' });
    assert.equal((await publicJobs(params)).total, 0);
    await db().query(
      "UPDATE jobs SET status='published',published=jsonb_set(published,'{deadline}',$2::jsonb) WHERE id=$1",
      [job.id, JSON.stringify(day(-1))],
    );
    clearPublicJobsCache();
    assert.equal((await publicJobs(params)).total, 0);
    // Concurrent, identical imports on different sources share one pending draft.
    const marker = randomUUID().replaceAll('-', '');
    const exact = {
      ...v,
      title: 'Backend ' + marker + ' Engineer',
      description:
        'Build reliable services and support existing applications. Work with the engineering team on production delivery.',
    };
    const pair = await Promise.all(
      ['hr', 'jobs'].map(async (source) => {
        const id = randomUUID();
        await discoverItems(source as 'hr' | 'jobs', [
          { externalId: id, url: v.url },
        ]);
        return (
          await db().query('SELECT id FROM source_items WHERE external_id=$1', [
            id,
          ])
        ).rows[0].id;
      }),
    );
    const outcomes = await Promise.all(
      pair.map((id, index) =>
        stageVacancy(id, { ...exact, source: index ? 'jobs.ge' : 'hr.ge' }),
      ),
    );
    assert.deepEqual(outcomes.sort(), ['imported', 'linked']);
    const shared = (
      await db().query(
        'SELECT DISTINCT job_id FROM source_items WHERE id=ANY($1::uuid[])',
        [pair],
      )
    ).rows;
    assert.equal(shared.length, 1);
    assert.equal(
      (await publicJobs(new URLSearchParams({ q: marker }))).total,
      0,
    );
    const sharedJob = (
      await db().query('SELECT * FROM jobs WHERE id=$1', [shared[0].job_id])
    ).rows[0];
    assert.equal(sharedJob.version, 2);
    await mutateJob({
      id: sharedJob.id,
      version: sharedJob.version,
      action: 'publish',
    });
    const found = await publicJobs(
      new URLSearchParams({
        q: 'Engineer ' + marker + ' Backend',
        sort: 'relevance',
      }),
    );
    assert.equal(
      found.total,
      1,
      'search matches all terms regardless of order',
    );
    assert.equal(found.jobs[0].sources.length, 2);
    const compact = await publicJobs(
      new URLSearchParams({ q: marker, summary: '1' }),
    );
    assert.equal(compact.total, found.total);
    assert.equal(compact.jobs[0].summary, true);
    assert.equal(compact.jobs[0].description, '');
    assert.equal(compact.jobs[0].facts, undefined);
    assert.equal(compact.jobs[0].applicationLinks, undefined);
    assert.ok(JSON.stringify(compact).length < JSON.stringify(found).length);
    assert.equal(found.jobs[0].sources[0].health, 'recent');
    const secondaryId = randomUUID();
    await discoverItems('hr', [{ externalId: secondaryId, url: v.url }]);
    const secondaryItem = (
      await db().query('SELECT id FROM source_items WHERE external_id=$1', [
        secondaryId,
      ])
    ).rows[0];
    await stageVacancy(secondaryItem.id, {
      ...exact,
      title: 'Coordinator ' + marker,
      deadline: day(15),
      description: exact.description + ' Backend Engineer support.',
    });
    const secondaryJob = (
      await db().query(
        'SELECT j.* FROM jobs j JOIN source_items i ON i.job_id=j.id WHERE i.id=$1',
        [secondaryItem.id],
      )
    ).rows[0];
    await mutateJob({
      id: secondaryJob.id,
      version: secondaryJob.version,
      action: 'publish',
    });
    // Search now defaults to title/employer/city; description relevance is
    // tested through the explicit wider-search option, preserving both matches.
    const ranked = await publicJobs(
      new URLSearchParams({
        q: 'Engineer ' + marker + ' Backend',
        sort: 'relevance',
        deep: 'true',
      }),
    );
    assert.equal(ranked.total, 2);
    assert.equal(
      ranked.jobs[0].id,
      sharedJob.id,
      'title match outranks a newer description-only match',
    );
    const byDeadline = await publicJobs(
      new URLSearchParams({ q: marker, sort: 'deadline' }),
    );
    assert.equal(
      byDeadline.jobs[0].id,
      secondaryJob.id,
      'earlier known deadlines come first',
    );

    await db().query('UPDATE source_items SET error=$2 WHERE id=$1', [
      pair[0],
      'private internal error',
    ]);
    // Direct fixture writes bypass the moderation API's cache invalidation.
    clearPublicJobsCache();
    const withFailure = await publicJobs(new URLSearchParams({ q: marker }));
    assert.ok(
      withFailure.jobs
        .find((job: { id: string }) => job.id === sharedJob.id)!
        .sources.some(
          (source: { health: string }) => source.health === 'unavailable',
        ),
    );
    assert.ok(!JSON.stringify(withFailure).includes('private internal error'));
    assert.equal(
      (await publicJobs(new URLSearchParams({ q: marker + ' missingword' })))
        .total,
      0,
    );
    const expiredExternal = randomUUID();
    await discoverItems('hr', [{ externalId: expiredExternal, url: v.url }]);
    const expiredItem = (
      await db().query('SELECT id FROM source_items WHERE external_id=$1', [
        expiredExternal,
      ])
    ).rows[0];
    assert.equal(
      await stageVacancy(expiredItem.id, { ...v, deadline: day(-1) }),
      'expired',
    );
    const expiredRecord = (
      await db().query(
        'SELECT job_id,raw,next_check_at FROM source_items WHERE id=$1',
        [expiredItem.id],
      )
    ).rows[0];
    assert.equal(expiredRecord.job_id, null);
    assert.equal(expiredRecord.raw.deadline, day(-1));
    assert.equal(expiredRecord.next_check_at, Infinity);
    // New-only keeps completed IDs as tombstones, even after deadline renewal.
    assert.equal(await stageVacancy(expiredItem.id, v), 'unchanged');
    assert.deepEqual(
      (
        await db().query(
          'SELECT job_id,raw,next_check_at FROM source_items WHERE id=$1',
          [expiredItem.id],
        )
      ).rows[0],
      expiredRecord,
    );
    await db().query("UPDATE sources SET auto_publish=true WHERE id='hr'");
    try {
      const autoExternal = randomUUID();
      const automatic = {
        ...v,
        title: 'AUTOMATIC-' + autoExternal,
        company: 'Automation Test',
      };
      await discoverItems('hr', [{ externalId: autoExternal, url: v.url }]);
      const autoItem = (
        await db().query('SELECT id FROM source_items WHERE external_id=$1', [
          autoExternal,
        ])
      ).rows[0];
      await stageVacancy(autoItem.id, automatic);
      const readAuto = async () =>
        (
          await db().query(
            'SELECT j.* FROM jobs j JOIN source_items i ON i.job_id=j.id WHERE i.id=$1',
            [autoItem.id],
          )
        ).rows[0];
      let autoJob = await readAuto();
      assert.equal(autoJob.status, 'published');
      assert.equal(autoJob.needs_review, false);
      const firstPublished = autoJob.published_at.toISOString();
      const changed = {
        ...automatic,
        description: automatic.description + ' Updated requirements.',
      };
      assert.equal(await stageVacancy(autoItem.id, changed), 'unchanged');
      autoJob = await readAuto();
      assert.equal(autoJob.published.description, automatic.description);
      assert.equal(
        autoJob.published_at.toISOString(),
        firstPublished,
        'completed imports keep both their content and publication time',
      );
      await db().query(
        "UPDATE source_items SET error='Source request failed: timeout' WHERE id=$1",
        [autoItem.id],
      );
      await transaction((c) => reconcileJob(c, autoJob.id));
      assert.equal(
        (await readAuto()).status,
        'published',
        'temporary network failure preserves verified listing',
      );
      await db().query(
        "UPDATE source_items SET error='Source returned HTTP 410' WHERE id=$1",
        [autoItem.id],
      );
      await transaction((c) => reconcileJob(c, autoJob.id));
      assert.equal((await readAuto()).status, 'archived');
      assert.equal(await stageVacancy(autoItem.id, changed), 'unchanged');
      assert.equal(
        (await readAuto()).status,
        'archived',
        'completed source IDs are not automatically resurrected',
      );
      await stageVacancy(autoItem.id, { ...changed, deadline: day(-1) });
      assert.equal((await readAuto()).status, 'archived');
      await stageVacancy(autoItem.id, { ...changed, company: '' });
      const heldSource = (
        await db().query(
          'SELECT raw,quality_candidate FROM source_items WHERE id=$1',
          [autoItem.id],
        )
      ).rows[0];
      assert.equal(heldSource.raw.company, changed.company);
      assert.equal(heldSource.raw.deadline, automatic.deadline);
      assert.equal(heldSource.quality_candidate, null);
      assert.equal(
        (await readAuto()).status,
        'archived',
        'a later invalid candidate cannot replace a completed snapshot',
      );
      assert.equal(
        (await readAuto()).needs_review,
        false,
        'ignored reimports do not create a manual review task',
      );
      assert.equal(await stageVacancy(autoItem.id, changed), 'unchanged');
      autoJob = await readAuto();
      await mutateJob({
        id: autoJob.id,
        version: autoJob.version,
        action: 'save',
        draft: { ...changed, title: 'Manual override' },
      });
      await stageVacancy(autoItem.id, {
        ...changed,
        description: changed.description + ' Another change.',
      });
      assert.equal(
        (await readAuto()).draft.title,
        'Manual override',
        'an explicit editorial override pauses automation',
      );
    } finally {
      await db().query("UPDATE sources SET auto_publish=false WHERE id='hr'");
    }
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async () => {
        throw new Error('connect timeout', {
          cause: { code: 'UND_ERR_CONNECT_TIMEOUT' },
        });
      };
      const deferred = await runSource('hrgov', 1);
      assert.ok('deferred' in deferred && deferred.deferred);
      const retryState = (
        await db().query("SELECT next_run_at FROM sources WHERE id='hrgov'")
      ).rows[0];
      assert.ok(retryState.next_run_at.getTime() - Date.now() > 23 * 3600000);
      const run = (
        await db().query(
          "SELECT status FROM source_runs WHERE source_id='hrgov' ORDER BY started_at DESC LIMIT 1",
        )
      ).rows[0];
      assert.equal(run.status, 'deferred');
    } finally {
      globalThis.fetch = originalFetch;
    }
    try {
      const firstId = String(Date.now()),
        secondId = String(Date.now() + 1);
      globalThis.fetch = async (input) => {
        const url = new URL(input instanceof Request ? input.url : input);
        if (url.pathname === '/robots.txt')
          return new Response('User-agent: *\nAllow: /');
        if (url.pathname.includes('/ads/'))
          return new Response(
            `<a href="/ge/?view=jobs&id=${url.searchParams.get('page') === '2' ? secondId : firstId}">Vacancy</a><script>if(loaded_page<2){loaded_page++; request('for_scroll=yes');}</script>`,
          );
        return new Response(
          `<table><tr><td class="dtitle"><b>Discovery test vacancy ${url.searchParams.get('id')}</b></td><td class="dtitle"><b>Test employer</b></td><td class="dtitle"><b>${georgianDay(0)}</b><b>${georgianDay(30)}</b></td></tr><tr><td>Join our experienced team and create excellent services for our customers.</td></tr></table>`,
        );
      };
      await db().query("UPDATE sources SET discovery_cursor=0 WHERE id='jobs'");
      const discovery = await runSource('jobs', 1);
      assert.ok('discovered' in discovery && discovery.discovered === 2);
      const foundIds = (
        await db().query(
          "SELECT external_id FROM source_items WHERE source_id='jobs' AND external_id=ANY($1::text[])",
          [[firstId, secondId]],
        )
      ).rows;
      assert.equal(
        foundIds.length,
        2,
        'jobs beyond page one must be retained even with a one-detail batch',
      );
      assert.equal(
        (
          await db().query(
            "SELECT discovery_cursor,reported_pages FROM sources WHERE id='jobs'",
          )
        ).rows[0].reported_pages,
        2,
      );
      assert.equal(
        (
          await db().query(
            "SELECT count(*)::int count FROM source_discovery_pages WHERE source_id='jobs'",
          )
        ).rows[0].count,
        2,
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  },
);
