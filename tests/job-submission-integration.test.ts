import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { db } from '../lib/server/db';
import { submitJob } from '../lib/server/job-submissions';
import { POST } from '../app/api/submissions/route';
import {
  adminJobs,
  publicJobs,
  mutateJob,
  bulkPublishCandidates,
} from '../lib/server/jobs';
import { submissionDate } from '../lib/job-submission';
import { classify } from '../worker/categories';
const enabled = process.env.RUN_DB_TESTS === '1';

void test(
  'direct submission is idempotent, moderated, published with 14 day benefit, filtered, expired and limited',
  { skip: !enabled },
  async () => {
    assert.equal(new URL(process.env.DATABASE_URL!).pathname, '/ertad_test');
    const key = 'SUBMISSIONTEST' + randomUUID().replaceAll('-', '');
    process.env.SESSION_SECRET ||=
      'isolated-submission-test-secret-at-least-32-characters';
    const base = {
      requestId: randomUUID(),
      placement: 'vip',
      title: 'გაყიდვების კონსულტანტი',
      company: key,
      category: '',
      city: 'თბილისი',
      mode: 'ადგილზე',
      employmentType: 'სრული განაკვეთი',
      salaryFrom: '1000',
      salaryTo: '1500',
      salaryPeriod: 'თვე',
      deadline: submissionDate(new Date(Date.now() + 30 * 86400000)),
      description:
        'მოვალეობები: მომხმარებელთან ურთიერთობა და პროდუქციის წარდგენა. სამუშაო გრაფიკი: ორშაბათიდან პარასკევის ჩათვლით, 10:00–18:00. გამოცდილება სასურველია.',
      contact: 'hr@example.com',
      consent: true,
      fax: '',
    };
    const ids: string[] = [];
    try {
      const results = await Promise.all([
        submitJob(base, key),
        submitJob(base, key),
      ]);
      ids.push(results[0].id);
      assert.equal(results[0].id, results[1].id);
      assert.equal(
        results.filter((result) => result.alreadyReceived).length,
        1,
      );
      const origin = new URL(process.env.APP_URL || 'https://jobx.ge').origin;
      const postSubmission = (input: unknown) =>
        POST(
          new Request('https://jobx.ge/api/submissions', {
            method: 'POST',
            headers: { origin, 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
          }),
        );
      const expiredPayload = { ...base, deadline: '2000-01-01' };
      const retry = await postSubmission(expiredPayload);
      assert.equal(retry.status, 200);
      assert.equal(retry.headers.get('Cache-Control'), 'no-store');
      const retryBody = await retry.json();
      assert.equal(retryBody.id, ids[0]);
      assert.equal(retryBody.received, true);
      assert.equal(retryBody.alreadyReceived, true);
      assert.equal(
        (
          await postSubmission({
            ...expiredPayload,
            requestId: randomUUID(),
          })
        ).status,
        400,
      );
      assert.equal(
        (await postSubmission({ ...expiredPayload, salaryTo: '500' })).status,
        400,
      );
      const changed = await submitJob({ ...base, title: 'different' }, key);
      assert.equal(changed.id, ids[0]);
      assert.equal(changed.alreadyReceived, true);
      let row = (await db().query('SELECT * FROM jobs WHERE id=$1', [ids[0]]))
        .rows[0];
      assert.equal(row.draft.title, base.title);
      assert.equal(row.draft.category, classify(base.title));
      assert.equal(row.status, 'pending');
      assert.equal(row.published, null);
      assert.equal(row.automation_paused, true);
      assert.equal(row.automation_managed, false);
      assert.equal(
        (await publicJobs(new URLSearchParams({ ids: ids[0] }))).total,
        0,
      );
      const reviewed = await adminJobs('review', key, 1, 'jobx');
      assert.equal(reviewed.jobs.length, 1);
      assert.equal(reviewed.jobs[0].requested_placement, 'vip');
      assert.ok(!(await bulkPublishCandidates()).some((v) => v.id === ids[0]));
      await assert.rejects(
        mutateJob({
          id: ids[0],
          version: row.version,
          action: 'resume-automation',
        }),
        /ადმინისტრატორი/,
      );
      await mutateJob({
        id: ids[0],
        version: row.version,
        action: 'publish',
        placement: 'vip',
      });
      row = (await db().query('SELECT * FROM jobs WHERE id=$1', [ids[0]]))
        .rows[0];
      assert.ok(
        Math.abs(
          new Date(row.placement_expires_at).getTime() -
            new Date(row.published_at).getTime() -
            14 * 86400000,
        ) < 1000,
      );
      const expires = row.placement_expires_at.toISOString();
      const visible = await publicJobs(
        new URLSearchParams({ q: key, source: 'JOBX', summary: '1' }),
      );
      assert.equal(visible.total, 1);
      assert.equal(visible.jobs[0].placement.tier, 'vip');
      assert.equal(visible.jobs[0].source, 'JOBX');
      assert.equal(
        (await publicJobs(new URLSearchParams({ q: key, city: 'ბათუმი' })))
          .total,
        0,
      );
      await mutateJob({
        id: ids[0],
        version: row.version,
        action: 'publish',
        placement: 'vip',
      });
      assert.equal(
        (
          await db().query(
            'SELECT placement_expires_at FROM jobs WHERE id=$1',
            [ids[0]],
          )
        ).rows[0].placement_expires_at.toISOString(),
        expires,
      );
      const second = await submitJob(
        { ...base, requestId: randomUUID(), title: key + ' SECOND' },
        key,
      );
      ids.push(second.id);
      await assert.rejects(
        mutateJob({
          id: second.id,
          version: 1,
          action: 'publish',
          placement: 'vip',
        }),
        /უკვე გამოყენებული/,
      );
      await mutateJob({
        id: second.id,
        version: 1,
        action: 'publish',
        placement: 'standard',
      });
      const ordinary = (
        await publicJobs(new URLSearchParams({ q: key, sort: 'new' }))
      ).jobs;
      assert.equal(
        ordinary[0].id,
        second.id,
        'newest sorting is not overridden by promotions',
      );
      const promoted = (await publicJobs(new URLSearchParams({ q: key }))).jobs;
      assert.equal(
        promoted[0].id,
        ids[0],
        'default sorting promotes a matching VIP vacancy',
      );
      await db().query(
        "UPDATE jobs SET placement_expires_at=now()-interval '1 second' WHERE id=$1",
        [ids[0]],
      );
      const expired = (await publicJobs(new URLSearchParams({ ids: ids[0] })))
        .jobs[0];
      assert.equal(
        expired.placement,
        undefined,
        'benefit expires without a scheduler',
      );
      assert.equal(
        expired.id,
        ids[0],
        'vacancy remains available after promotion ends',
      );
      for (let n = 0; n < 3; n++)
        ids.push(
          (
            await submitJob(
              { ...base, requestId: randomUUID(), title: key + n },
              key,
            )
          ).id,
        );
      await assert.rejects(
        submitJob({ ...base, requestId: randomUUID() }, key),
        /ლიმიტი/,
      );
    } finally {
      await db().query(
        'DELETE FROM job_submissions WHERE job_id=ANY($1::uuid[])',
        [ids],
      );
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
