import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { db } from '../lib/server/db';
import { runNotificationJobs, digestDue, notificationDay } from '../lib/server/notification-jobs';
import { extendedDeadline, extendJobDeadline } from '../lib/server/job-deadline';
import { companyNotifications, saveCompanyNotifications } from '../lib/server/company-notifications';
import { deliverNotifications, queueNotification } from '../lib/server/notification-email';
import { applicationsEmail } from '../lib/notification-emails';
import { transaction } from '../lib/server/db';
import type { CompanyIdentity } from '../lib/company-portal';

const local = (() => {
  try { const u = new URL(process.env.DATABASE_URL || ''); return ['localhost', '127.0.0.1'].includes(u.hostname) && u.pathname === '/jobx_company_local'; }
  catch { return false; }
})();
test('digest respects 09:00 Tbilisi and the local date boundary', () => {
  assert.equal(digestDue(new Date('2026-11-16T04:59:59Z'), null), false);
  assert.equal(digestDue(new Date('2026-11-16T05:00:00Z'), null), true);
  assert.equal(digestDue(new Date('2026-11-16T12:00:00Z'), '2026-11-16'), false);
  assert.equal(notificationDay(new Date('2026-11-16T21:00:00Z')), '2026-11-17');
});
test('extension rules enforce review, publication and a bounded date', () => {
  const now = new Date('2026-11-16T06:00:00Z');
  const job = { id: 'test', status: 'published', needs_review: false, draft: {}, published: { deadline: '2026-11-19' } };
  assert.equal(extendedDeadline(job, now), '2026-12-19');
  assert.equal(extendedDeadline({ ...job, published: { deadline: '2020-01-01' } }, now), '2026-12-16');
  assert.throws(() => extendedDeadline({ ...job, needs_review: true }, now));
  assert.throws(() => extendedDeadline({ ...job, status: 'pending' }, now));
  assert.throws(() => extendedDeadline({ ...job, published: { deadline: '2027-03-01' } }, now));
  assert.ok(Date.parse(extendedDeadline(job, now)) <= Date.parse('2027-02-14'));
});
test('notification jobs and extension are isolated to test-owned fixtures', { skip: !local }, async t => {
  const key = 'notification-test-' + randomUUID();
  const jobId = randomUUID(), resumeId = randomUUID(), accountId = randomUUID();
  const company: CompanyIdentity = { id: accountId, companyKey: key, name: 'Notification test', username: key, email: 'owner@example.com', role: 'owner', emailVerified: true, approvalStatus: 'approved', mustChangePassword: false, representativeName: '' };
  const oldFlag = process.env.NOTIFICATION_EMAIL_ENABLED;
  process.env.NOTIFICATION_EMAIL_ENABLED = 'false';
  const query = (sql: string, values?: unknown[]) => db().query(sql, values);
  const run = (iso: string) => runNotificationJobs(new Date(iso), { companyKey: key, deliver: false });
  const count = async (kind: string) => Number((await query("SELECT count(*) n FROM notification_emails WHERE kind=$1 AND (dedupe_key LIKE $2 OR dedupe_key LIKE $3)", [kind, `%${key}%`, `%${jobId}%`])).rows[0].n);
  async function upload(at: string, source = 'cv_box', email = randomUUID() + '@example.com') {
    const hash = createHash('sha256').update(randomUUID()).digest('hex');
    await query(`INSERT INTO company_cv_uploads(company_key,job_id,name,email,phone,file_name,file_hash,file_size,content,source,created_at)
      VALUES($1,$2,'Private Name',$3,'599123456','test.pdf',$4,1,$5,$6,$7)`, [key, jobId, email, hash, Buffer.from('x'), source, at]);
  }
  try {
    await query("INSERT INTO company_profiles(company_key,name) VALUES($1,'Notification test')", [key]);
    await query(`INSERT INTO company_accounts(id,company_key,username,email,password_hash,role,created_at)
      VALUES($1,$2,$2,'owner@example.com','unused','owner','2026-11-15T00:00Z')`, [accountId, key]);
    await query(`INSERT INTO jobs(id,draft,published,status,needs_review,fingerprint)
      VALUES($1,$2,$2,'published',false,$3)`, [jobId, { title: 'Test vacancy', deadline: '2026-11-19' }, jobId]);
    await query('INSERT INTO company_job_ownership(job_id,company_key) VALUES($1,$2)', [jobId, key]);
    await query(`INSERT INTO company_notification_settings(company_key,applications_seen_until,deadline_reminders)
      VALUES($1,'2026-11-16T00:00Z',false)`, [key]);
    await t.test('digest waits until nine, includes all three sources and excludes staff uploads', async () => {
      await upload('2026-11-16T04:00Z');
      await upload('2026-11-16T04:00Z', 'upload');
      await query(`INSERT INTO swipe_applications(job_id,candidate_key,candidate_name,candidate_email,client_hash,cv_kind,recipient,status,sent_at)
        VALUES($1,$2,'Private Name','candidate@example.com',$2,'upload','owner@example.com','sent','2026-11-16T04:00Z')`, [jobId, 'a'.repeat(64)]);
      await query('INSERT INTO resumes(id,delete_token_hash,cv,expires_at) VALUES($1,$2,$3,now()+interval \'1 year\')', [resumeId, 'hash', { fullName: 'Private Name', email: 'candidate@example.com' }]);
      await query("INSERT INTO resume_contacts(job_id,resume_id,kind,first_at) VALUES($1,$2,'cv','2026-11-16T04:00Z')", [jobId, resumeId]);
      await run('2026-11-16T04:59Z'); assert.equal(await count('applications'), 0);
      await run('2026-11-16T05:00Z'); assert.equal(await count('applications'), 1);
      const payload = (await query("SELECT payload FROM notification_emails WHERE dedupe_key=$1", [`applications:${key}:2026-11-16`])).rows[0].payload;
      assert.match(payload.text, /3 განაცხადი/); assert.doesNotMatch(payload.text, /Private Name|candidate@example.com|599123456/);
      await upload('2026-11-16T06:00Z');
      await run('2026-11-16T07:00Z'); assert.equal(await count('applications'), 1);
      await run('2026-11-17T05:00Z'); assert.equal(await count('applications'), 2);
    });
    await t.test('instant processes each run once; off advances the watermark', async () => {
      await query("UPDATE company_notification_settings SET application_mode='instant' WHERE company_key=$1", [key]);
      await upload('2026-11-17T06:00Z');
      await Promise.all([run('2026-11-17T07:00Z'), run('2026-11-17T07:00Z')]);
      assert.equal(await count('applications'), 3);
      await upload('2026-11-17T08:00Z'); await run('2026-11-17T09:00Z');
      assert.equal(await count('applications'), 4);
      await query("UPDATE company_notification_settings SET application_mode='off' WHERE company_key=$1", [key]);
      await upload('2026-11-17T10:00Z'); await run('2026-11-17T11:00Z');
      assert.equal(await count('applications'), 4);
      const s = (await query('SELECT applications_seen_until FROM company_notification_settings WHERE company_key=$1', [key])).rows[0];
      assert.equal(s.applications_seen_until.toISOString(), '2026-11-17T11:00:00.000Z');
      await query("UPDATE company_notification_settings SET application_mode='instant' WHERE company_key=$1", [key]);
      await run('2026-11-17T12:00Z'); assert.equal(await count('applications'), 4);
    });
    await t.test('free vacancies never create a deadline reminder or invoice', async () => {
      await query('UPDATE company_notification_settings SET deadline_reminders=true WHERE company_key=$1', [key]);
      await run('2026-11-17T06:00Z'); await run('2026-11-17T07:00Z');
      assert.equal(await count('deadline'), 0);
      assert.equal((await query('SELECT count(*)::int n FROM job_invoices WHERE job_id=$1', [jobId])).rows[0].n, 0);
    });
    await t.test('legacy auto-replies are ignored, never queued and never delivered', async t => {
      await query("UPDATE company_notification_settings SET auto_reply_template='rejected',auto_reply_since='2026-11-17T12:00Z' WHERE company_key=$1", [key]);
      for (const legacy of [
        { auto_reply: true, auto_reply_template: 'interview' },
        { auto_reply: false, auto_reply_template: 'arbitrary old client text' },
        {},
      ]) {
        const result = await saveCompanyNotifications(company, {
          application_mode: 'off', deadline_reminders: false, ...legacy,
        });
        assert.deepEqual(result, { application_mode: 'off', deadline_reminders: false });
        const stored = (await query('SELECT auto_reply,auto_reply_template,auto_reply_since FROM company_notification_settings WHERE company_key=$1', [key])).rows[0];
        assert.equal(stored.auto_reply, false);
        assert.equal(stored.auto_reply_template, 'rejected');
        assert.equal(stored.auto_reply_since.toISOString(), '2026-11-17T12:00:00.000Z');
      }
      assert.deepEqual(await companyNotifications(company), { application_mode: 'off', deadline_reminders: false });
      await assert.rejects(saveCompanyNotifications({ ...company, role: 'recruiter' }, {}), /მფლობელს/);
      await query("UPDATE company_notification_settings SET auto_reply=true,auto_reply_since='2026-11-17T12:00Z' WHERE company_key=$1", [key]);
      await upload('2026-11-17T13:00Z');
      await run('2026-11-17T14:00Z'); await run('2026-11-17T15:00Z');
      assert.equal(await count('candidate_ack'), 0);

      const legacyId = randomUUID();
      await query("INSERT INTO notification_emails(id,kind,dedupe_key,payload) VALUES($1,'candidate_ack',$2,$3)",
        [legacyId, `ack:${key}:legacy`, applicationsEmail([], 'candidate@example.com', 'https://jobx.ge')]);
      const before = (await query('SELECT * FROM notification_emails WHERE id=$1', [legacyId])).rows[0];
      const oldApiKey = process.env.RESEND_API_KEY;
      const pool = db(), originalQuery = pool.query.bind(pool);
      // Exercise the real claiming SQL against PostgreSQL, scoped to our fixture:
      // delivery must not claim any other company's pending mail in this shared DB.
      const queryMock = t.mock.method(pool, 'query', (sql: string, values?: unknown[]) => {
        if (sql.includes('WITH candidate AS')) {
          return originalQuery(sql.replace('WHERE kind', 'WHERE id=$1 AND kind'), [legacyId]);
        }
        return originalQuery(sql, values);
      });
      const fetchMock = t.mock.method(globalThis, 'fetch', async () => {
        throw new Error('No provider request is allowed for a legacy acknowledgement');
      });
      try {
        process.env.NOTIFICATION_EMAIL_ENABLED = 'true';
        process.env.RESEND_API_KEY = 'test-no-network';
        assert.deepEqual(await deliverNotifications(), { sent: 0, failed: 0, disabled: false });
        assert.equal(fetchMock.mock.callCount(), 0);
        assert.deepEqual((await query('SELECT * FROM notification_emails WHERE id=$1', [legacyId])).rows[0], before);
      } finally {
        queryMock.mock.restore(); fetchMock.mock.restore();
        process.env.NOTIFICATION_EMAIL_ENABLED = 'false';
        if (oldApiKey === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = oldApiKey;
      }
    });
    await t.test('queue conflicts do not duplicate; disabled delivery keeps pending', async () => {
      const input = { kind: 'applications' as const, dedupeKey: `test:${key}`, payload: applicationsEmail([], 'owner@example.com', 'https://jobx.ge') };
      assert.equal(await transaction(c => queueNotification(c, input)), true);
      assert.equal(await transaction(c => queueNotification(c, input)), false);
      const result = await runNotificationJobs(new Date('2026-11-17T16:00Z'), { companyKey: key });
      assert.equal(result.disabled, true);
      assert.equal((await query('SELECT status FROM notification_emails WHERE dedupe_key=$1', [input.dedupeKey])).rows[0].status, 'pending');
    });
    await t.test('extend enforces ownership and review; updates both copies and audit', async () => {
      await assert.rejects(extendJobDeadline({ ...company, companyKey: 'other' }, jobId), (e: unknown) => (e as { status: number }).status === 404);
      await query("UPDATE jobs SET needs_review=true WHERE id=$1", [jobId]);
      await assert.rejects(extendJobDeadline(company, jobId), /შემოწმებას/);
      const today = notificationDay(new Date());
      await query(`UPDATE jobs SET needs_review=false,published=jsonb_set(published,'{deadline}',to_jsonb($2::text)) WHERE id=$1`, [jobId, today]);
      const result = await extendJobDeadline(company, jobId);
      const job = (await query('SELECT draft,published,version FROM jobs WHERE id=$1', [jobId])).rows[0];
      assert.equal(job.draft.deadline, result.deadline); assert.equal(job.published.deadline, result.deadline); assert.equal(job.version, 2);
      assert.ok(Date.parse(result.deadline) <= Date.parse(today) + 90 * 86400000);
      assert.equal((await query("SELECT count(*)::int n FROM audit_log WHERE job_id=$1 AND action='deadline.extended'", [jobId])).rows[0].n, 1);
      await assert.rejects(extendJobDeadline(company, jobId), /7 დღით/);
    });
  } finally {
    await query('DELETE FROM notification_emails WHERE dedupe_key LIKE $1 OR dedupe_key LIKE $2', [`%${key}%`, `%${jobId}%`]);
    await query('DELETE FROM company_cv_uploads WHERE company_key=$1', [key]);
    await query('DELETE FROM audit_log WHERE job_id=$1', [jobId]);
    await query('DELETE FROM company_job_ownership WHERE company_key=$1', [key]);
    await query('DELETE FROM jobs WHERE id=$1', [jobId]);
    await query('DELETE FROM resumes WHERE id=$1', [resumeId]);
    await query('DELETE FROM company_accounts WHERE company_key=$1', [key]);
    await query('DELETE FROM company_profiles WHERE company_key=$1', [key]);
    if (oldFlag === undefined) delete process.env.NOTIFICATION_EMAIL_ENABLED; else process.env.NOTIFICATION_EMAIL_ENABLED = oldFlag;
    await db().end();
  }
});
