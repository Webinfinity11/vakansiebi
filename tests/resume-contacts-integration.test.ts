import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { db } from '../lib/server/db';
import { recordResumeContact, saveResume } from '../lib/server/resumes';
import {
  resumeContacts,
  submissionPerformance,
} from '../lib/server/vacancy-analytics';
import { emptyCv } from '../lib/cv';

void test(
  'a JOBX-built CV is tied to our own vacancy only by its holder, and only there',
  { skip: process.env.RUN_DB_TESTS !== '1' },
  async () => {
    assert.equal(new URL(process.env.DATABASE_URL!).pathname, '/ertad_test');
    const ours = randomUUID(),
      imported = randomUUID(),
      test_ = randomUUID();
    const resume = { id: randomUUID(), token: randomUUID() };
    const snapshot = { title: 'მოლარე', company: 'ფიქსტურა', city: 'თბილისი' };
    try {
      for (const id of [ours, imported, test_])
        await db().query(
          "INSERT INTO jobs(id,draft,published,status,fingerprint,published_at) VALUES($1::uuid,$2,$2,'published',$1::text,now())",
          [id, snapshot],
        );
      for (const [id, isTest] of [
        [ours, false],
        [test_, true],
      ] as const)
        await db().query(
          "INSERT INTO job_submissions(request_id,job_id,client_hash,payload_hash,is_test) VALUES($1,$2,'c','p',$3)",
          [randomUUID(), id, isTest],
        );
      await saveResume({
        ...resume,
        cv: {
          ...emptyCv('ka'),
          fullName: 'ნინო ტესტი',
          phone: '555 12 34 56',
          email: 'nino@example.com',
        },
      });
      await recordResumeContact({ ...resume, job: ours, kind: 'cv' });
      await recordResumeContact({ ...resume, job: ours, kind: 'cv' });
      await recordResumeContact({ ...resume, job: ours, kind: 'call' });
      // Someone else's token, an imported vacancy and a test submission record nothing.
      await recordResumeContact({
        id: resume.id,
        token: randomUUID(),
        job: ours,
        kind: 'apply',
      });
      await recordResumeContact({ ...resume, job: imported, kind: 'cv' });
      await recordResumeContact({ ...resume, job: test_, kind: 'cv' });
      const people = await resumeContacts(ours);
      assert.equal(people.length, 1);
      assert.equal(people[0].fullName, 'ნინო ტესტი');
      assert.equal(people[0].phone, '555 12 34 56');
      assert.deepEqual(people[0].kinds, [
        { kind: 'call', presses: 1 },
        { kind: 'cv', presses: 2 },
      ]);
      assert.deepEqual(await resumeContacts(imported), []);
      assert.deepEqual(await resumeContacts(test_), []);
      const listed = (await submissionPerformance()).find((j) => j.id === ours);
      assert.equal(listed?.people, 1);
      // Deleting the CV removes every trace of it.
      await db().query('DELETE FROM resumes WHERE id=$1', [resume.id]);
      assert.equal(
        (
          await db().query('SELECT 1 FROM resume_contacts WHERE job_id=$1', [
            ours,
          ])
        ).rowCount,
        0,
      );
    } finally {
      await db().query('DELETE FROM resumes WHERE id=$1', [resume.id]);
      await db().query('DELETE FROM job_submissions WHERE job_id=ANY($1)', [
        [ours, test_],
      ]);
      await db().query('DELETE FROM jobs WHERE id=ANY($1)', [
        [ours, imported, test_],
      ]);
      await db().end();
    }
  },
);
