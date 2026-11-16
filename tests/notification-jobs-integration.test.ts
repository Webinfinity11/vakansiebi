import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { db } from '../lib/server/db';
import { runNotificationJobs, digestDue, notificationDay } from '../lib/server/notification-jobs';
import { extendedDeadline, extendJobDeadline } from '../lib/server/job-deadline';
import { companyNotifications, saveCompanyNotifications } from '../lib/server/company-notifications';
import { queueNotification } from '../lib/server/notification-email';
import { applicationsEmail, formatDeadlineDate } from '../lib/notification-emails';
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
test('deadline dates use Georgian months with an optional year', () => {
  assert.equal(formatDeadlineDate('2026-12-18', true), '18 დეკემბერი, 2026');
  assert.equal(formatDeadlineDate('2026-12-18'), '18 დეკემბერი');
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
    await t.test('deadline window catches +2 once, excludes yesterday and deduplicates per date', async () => {
      await query('UPDATE company_notification_settings SET deadline_reminders=true WHERE company_key=$1', [key]);
      await run('2026-11-17T06:00Z'); await run('2026-11-17T07:00Z');
      assert.equal(await count('deadline'), 1);
      const payload = (await query('SELECT payload FROM notification_emails WHERE dedupe_key=$1', [`deadline:${jobId}:2026-11-19`])).rows[0].payload;
      assert.match(payload.text, /2 დღეში/);
      await query(`UPDATE jobs SET published=jsonb_set(published,'{deadline}','"2026-11-16"') WHERE id=$1`, [jobId]);
      await run('2026-11-17T08:00Z'); assert.equal(await count('deadline'), 1);
      await query(`UPDATE jobs SET published=jsonb_set(published,'{deadline}','"2026-11-20"') WHERE id=$1`, [jobId]);
      await run('2026-11-17T06:00Z'); assert.equal(await count('deadline'), 2);
    });
    await t.test('ack starts at enable time, respects safeEmail, uses saved template and deduplicates', async () => {
      await assert.rejects(saveCompanyNotifications(company, { application_mode: 'off', deadline_reminders: false, auto_reply: true, auto_reply_template: 'interview' }), /შესავსებ ადგილს/);
      await saveCompanyNotifications(company, { application_mode: 'off', deadline_reminders: false, auto_reply: true, auto_reply_template: 'received' });
      assert.ok((await query('SELECT auto_reply_since FROM company_notification_settings WHERE company_key=$1', [key])).rows[0].auto_reply_since);
      await query("UPDATE company_notification_settings SET auto_reply_since='2026-11-17T12:00Z' WHERE company_key=$1", [key]);
      await query("INSERT INTO company_message_templates(company_key,kind,subject,body,updated_by) VALUES($1,'received','მივიღეთ — {ვაკანსია}','გამარჯობა, {სახელი}!', $2)", [key, accountId]);
      await upload('2026-11-17T13:00Z'); await upload('2026-11-17T13:00Z', 'cv_box', 'invalid');
      await run('2026-11-17T14:00Z'); await run('2026-11-17T15:00Z');
      assert.equal(await count('candidate_ack'), 1);
      const payload = (await query("SELECT payload FROM notification_emails WHERE kind='candidate_ack' AND dedupe_key LIKE $1", [`%${key}%`])).rows[0].payload;
      assert.match(payload.subject, /მივიღეთ — Test vacancy/);
      await query("UPDATE company_message_templates SET body='{თარიღი}' WHERE company_key=$1 AND kind='received'", [key]);
      await upload('2026-11-17T15:30Z');
      await run('2026-11-17T16:00Z');
      assert.equal(await count('candidate_ack'), 2);
      const fallback = (await query("SELECT payload FROM notification_emails WHERE kind='candidate_ack' AND dedupe_key LIKE $1", [`%${key}%`])).rows.map(row => row.payload).find(p => p.subject.includes('განაცხადი მივიღეთ'));
      assert.ok(fallback);
      assert.doesNotMatch(fallback.text, /\{თარიღი\}/);
      await assert.rejects(saveCompanyNotifications({ ...company, role: 'recruiter' }, {}), /მფლობელს/);
    });
    await t.test('rejects outcome templates and safely handles legacy stored outcomes', async () => {
      for (const kind of ['rejected', 'accepted']) {
        await assert.rejects(saveCompanyNotifications(company, { application_mode: 'off', deadline_reminders: false, auto_reply: true, auto_reply_template: kind }),
          (e: unknown) => (e as { status: number }).status === 400 && /ავტომატურ პასუხად ვერ გაიგზავნება/.test((e as Error).message));
      }
      assert.deepEqual(Object.keys((await companyNotifications(company)).templates), ['received', 'information', 'interview']);
      await query("UPDATE company_notification_settings SET auto_reply_template='rejected' WHERE company_key=$1", [key]);
      await query("UPDATE company_message_templates SET body='მიღებულია, {სახელი}!' WHERE company_key=$1 AND kind='received'", [key]);
      await upload('2026-11-17T16:30Z', 'cv_box', 'legacy-saved@example.com');
      await run('2026-11-17T17:00Z');
      const payloads = async () => (await query("SELECT payload FROM notification_emails WHERE kind='candidate_ack' AND dedupe_key LIKE $1", [`%${key}%`])).rows.map(row => row.payload);
      const saved = (await payloads()).find(p => p.to.includes('legacy-saved@example.com'));
      assert.match(saved.subject, /მივიღეთ — Test vacancy/);
      assert.match(saved.text, /მიღებულია, Private!/);
      await query("UPDATE company_message_templates SET body='{თარიღი}' WHERE company_key=$1 AND kind='received'", [key]);
      await upload('2026-11-17T17:30Z', 'cv_box', 'legacy-default@example.com');
      await run('2026-11-17T18:00Z');
      const fallback = (await payloads()).find(p => p.to.includes('legacy-default@example.com'));
      assert.match(fallback.subject, /განაცხადი მივიღეთ/);
      assert.doesNotMatch(fallback.text, /\{თარიღი\}/);
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
    await query('DELETE FROM company_message_templates WHERE company_key=$1', [key]);
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
