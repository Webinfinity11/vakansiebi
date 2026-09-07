import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { db } from '../lib/server/db';
import { discoverItems, stageVacancy } from '../worker/importer';
import { mutateJob, publicJobs } from '../lib/server/jobs';
import { getCompany, saveCompany } from '../lib/server/companies';
import type { Vacancy } from '../lib/types';
const enabled = process.env.RUN_DB_TESTS === '1';
void test(
  'moderation preserves public snapshot, detects conflicts, merges provenance and excludes expired jobs',
  { skip: !enabled },
  async () => {
    // Only a separate database explicitly named ertad_test may be mutated by this test.
    assert.equal(new URL(process.env.DATABASE_URL!).pathname, '/ertad_test');
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
      deadline: '2099-01-01',
      datePosted: '2026-09-07',
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
    await stageVacancy(item.id, { ...v, title: v.title + ' source changed' });
    job = (await db().query('SELECT * FROM jobs WHERE id=$1', [job.id]))
      .rows[0];
    assert.equal(job.draft.title, edited.title);
    assert.equal(job.published.title, edited.title);
    assert.equal(job.needs_review, true);
    await assert.rejects(
      () =>
        mutateJob({ id: job.id, version: job.version - 1, action: 'archive' }),
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
      "UPDATE jobs SET status='published',published=jsonb_set(published,'{deadline}','\"2020-01-01\"') WHERE id=$1",
      [job.id],
    );
    assert.equal((await publicJobs(params)).total, 0);
    await db().end();
  },
);
