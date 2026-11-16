import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Vacancy } from '../lib/types';

void test('rejection is atomic, notifies real submissions once and is visible only while rejected', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const url = new URL(process.env.DATABASE_URL!);
  assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
  assert.equal(url.pathname, '/jobx_company_local');
  const { db, transaction } = await import('../lib/server/db');
  const { mutateJob } = await import('../lib/server/jobs');
  const { recordJobRejection, queueRejectionEmail } = await import('../lib/server/job-rejections');
  const { companyJobs } = await import('../lib/server/company-jobs');
  const key = 'rejectionqa' + randomUUID().replaceAll('-', '');
  const ids = [randomUUID(), randomUUID(), randomUUID()];
  const owner = { id: randomUUID(), companyKey: key, name: key, username: key,
    email: key + '@example.com', mustChangePassword: false, role: 'owner' as const,
    approvalStatus: 'approved' as const, emailVerified: true, representativeName: 'QA' };
  const vacancy: Vacancy = {
    title: 'სატესტო მოლარე', company: key, city: 'თბილისი', category: 'გაყიდვები',
    salary: '', salaryMin: null, currency: 'GEL', salaryPeriod: 'თვე', mode: 'ადგილზე',
    description: 'სატესტო განცხადება ინტეგრაციის შემოწმებისთვის.', url: 'https://jobx.ge',
    source: 'JOBX', deadline: '', datePosted: '', logoUrl: '', employmentType: '',
    facts: [], applicationLinks: [], warnings: [],
  };
  const reject = (id: string, version: number, value: { reason?: string; note?: string }) => mutateJob(
    { id, version, action: 'reject' }, undefined, async client => { await recordJobRejection(client, id, value); },
  );
  try {
    await db().query('INSERT INTO company_profiles(company_key,name) VALUES($1,$1)', [key]);
    for (const [i, id] of ids.entries()) {
      await db().query("INSERT INTO jobs(id,draft,status,fingerprint) VALUES($1,$2,'pending',$3)", [id, vacancy, id]);
      await db().query('INSERT INTO company_job_ownership(job_id,company_key) VALUES($1,$2)', [id, key]);
      if (i < 2) await db().query(`INSERT INTO job_submissions(request_id,job_id,client_hash,payload_hash,notification_email,is_test)
        VALUES($1,$2,$3,$4,$5,$6)`, [id, id, key, key, owner.email, i === 1]);
    }
    await assert.rejects(reject(ids[0], 1, {}));
    assert.equal((await db().query('SELECT status FROM jobs WHERE id=$1', [ids[0]])).rows[0].status, 'pending');
    await reject(ids[0], 1, { reason: 'other', note: 'დააზუსტეთ სამუშაო საათები' });
    const rejection = (await db().query('SELECT reason,note FROM job_rejections WHERE job_id=$1', [ids[0]])).rows[0];
    assert.deepEqual(rejection, { reason: 'other', note: 'დააზუსტეთ სამუშაო საათები' });
    const email = (await db().query('SELECT kind,payload FROM notification_emails WHERE dedupe_key=$1', [`rejected:${ids[0]}:2`])).rows[0];
    assert.equal(email.kind, 'job_rejected');
    assert.match(email.payload.text, /დააზუსტეთ სამუშაო საათები/);
    assert.deepEqual(email.payload.to, [owner.email]);
    await transaction(async client => { assert.equal(await queueRejectionEmail(client, { id: ids[0] }), false); });
    const listed = (await companyJobs(owner)).find(job => job.id === ids[0])!;
    assert.equal(listed.rejection?.reason, 'other');
    assert.equal(listed.rejection?.note, rejection.note);
    await reject(ids[1], 1, { reason: 'incomplete' });
    assert.equal((await db().query('SELECT 1 FROM notification_emails WHERE dedupe_key=$1', [`rejected:${ids[1]}:2`])).rowCount, 0);
    await reject(ids[2], 1, {});
    assert.equal((await db().query('SELECT status FROM jobs WHERE id=$1', [ids[2]])).rows[0].status, 'rejected');
    assert.equal((await db().query('SELECT 1 FROM job_rejections WHERE job_id=$1', [ids[2]])).rowCount, 0);
    await mutateJob({ id: ids[0], version: 2, action: 'restore' });
    assert.equal((await companyJobs(owner)).find(job => job.id === ids[0])!.rejection, null);
    await reject(ids[0], 3, { reason: 'incomplete' });
    assert.equal((await db().query('SELECT reason FROM job_rejections WHERE job_id=$1', [ids[0]])).rows[0].reason, 'incomplete');
    assert.equal((await db().query('SELECT 1 FROM notification_emails WHERE dedupe_key=$1', [`rejected:${ids[0]}:4`])).rowCount, 1);
  } finally {
    await db().query("DELETE FROM notification_emails WHERE dedupe_key=ANY($1::text[])", [ids.flatMap(id => [2, 4].map(version => `rejected:${id}:${version}`))]);
    await db().query('DELETE FROM job_submissions WHERE job_id=ANY($1::uuid[])', [ids]);
    await db().query('DELETE FROM company_job_ownership WHERE company_key=$1', [key]);
    await db().query('DELETE FROM audit_log WHERE job_id=ANY($1::uuid[])', [ids]);
    await db().query('DELETE FROM jobs WHERE id=ANY($1::uuid[])', [ids]);
    await db().query('DELETE FROM company_profiles WHERE company_key=$1', [key]);
    await db().end();
  }
});
