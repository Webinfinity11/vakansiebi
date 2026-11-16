import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Vacancy } from '../lib/types';

function localDatabase() {
  try {
    const url = new URL(process.env.DATABASE_URL || '');
    return ['localhost', '127.0.0.1'].includes(url.hostname) && url.pathname === '/jobx_company_local';
  } catch { return false; }
}

void test('trusted companies and admin notification queue (local database only)', { skip: !localDatabase() }, async t => {
  const { db } = await import('../lib/server/db');
  const { companyTrusted, autoPublishIfTrusted } = await import('../lib/server/trusted-companies');
  const { changeCompanyJob } = await import('../lib/server/company-jobs');
  const { changeCompanyAccount } = await import('../lib/server/company-accounts');
  const { queueAdminNotifications } = await import('../lib/server/admin-notifications');
  const key = 'trustqa' + randomUUID().replaceAll('-', '');
  const ids: string[] = [];
  const owner = { id: randomUUID(), companyKey: key, name: key, username: key,
    email: `${key}@example.com`, mustChangePassword: false, role: 'owner' as const,
    approvalStatus: 'approved' as const, emailVerified: true, representativeName: 'QA' };
  const envKeys = ['ADMIN_NOTIFY_EMAIL', 'ADMIN_NOTIFY_DAILY_LIMIT', 'APP_URL', 'SESSION_SECRET', 'GOOGLE_INDEXING_DAILY_LIMIT'] as const;
  const previousEnv = new Map(envKeys.map(k => [k, process.env[k]]));
  const oldState = (await db().query("SELECT * FROM notification_state WHERE key='admin_review'")).rows[0];
  const oldBilling = (await db().query('SELECT * FROM billing_settings WHERE id=true')).rows[0];
  const queueKeys = ['admin:2098-06-10:1', 'admin:2098-06-11:1'];
  // Do not overwrite someone else's fixture or queued message.
  assert.equal((await db().query('SELECT 1 FROM notification_emails WHERE dedupe_key=ANY($1::text[])', [queueKeys])).rowCount, 0);
  const draft: Vacancy = { title: 'სატესტო მოლარე', company: key, city: 'თბილისი', category: 'გაყიდვები',
    salary: '', salaryMin: null, currency: 'GEL', salaryPeriod: 'თვე', mode: 'ადგილზე',
    description: 'სატესტო განცხადება ინტეგრაციის შემოწმებისთვის.', url: 'https://jobx.ge', source: 'JOBX',
    deadline: '', datePosted: '', logoUrl: '', employmentType: 'სრული განაკვეთი', facts: [], applicationLinks: [], warnings: [] };
  async function fixture(published = false) {
    const id = randomUUID(); ids.push(id);
    await db().query(`INSERT INTO jobs(id,draft,status,published,published_at,fingerprint)
      VALUES($1,$2,$3,$4,CASE WHEN $5::boolean THEN now() ELSE NULL END,$6)`,
    [id, draft, published ? 'published' : 'pending', published ? draft : null, published, id]);
    await db().query('INSERT INTO company_job_ownership(job_id,company_key) VALUES($1,$2)', [id, key]);
    await db().query(`INSERT INTO job_submissions(request_id,job_id,client_hash,payload_hash,notification_email,requested_placement)
      VALUES($1,$2,$3,$4,$5,'standard')`, [randomUUID(), id, key, key, owner.email]);
    return id;
  }
  async function create(placement: 'standard' | 'vip' = 'standard') {
    const result = await changeCompanyJob(owner, { action: 'create', requestId: randomUUID(), form: {
      title: 'ახალი მოლარე', placement, city: 'თბილისი', category: 'გაყიდვები', mode: 'ადგილზე', employmentType: 'სრული განაკვეთი',
      salaryFrom: '', salaryTo: '', salaryPeriod: 'თვე', description: draft.description, contact: owner.email,
      deadline: new Date(Date.now() + 15 * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Tbilisi' }),
    } });
    assert.ok('id' in result);
    ids.push(result.id);
    return result;
  }
  async function job(id: string) { return (await db().query('SELECT * FROM jobs WHERE id=$1', [id])).rows[0]; }
  try {
    process.env.SESSION_SECRET = 'trusted-companies-local-test-secret-1234567890';
    process.env.APP_URL = 'http://127.0.0.1:3270';
    process.env.GOOGLE_INDEXING_DAILY_LIMIT = '0';
    await db().query("INSERT INTO company_profiles(company_key,name,approval_status) VALUES($1,$2,'approved')", [key, key]);
    await db().query(`INSERT INTO company_accounts(id,company_key,username,email,password_hash,must_change_password,email_verified)
      VALUES($1,$2,$3,$4,'unused-test-password',false,true)`, [owner.id, key, key, owner.email]);

    await t.test('auto: two publications wait, three publish and record the marker', async () => {
      await fixture(true); await fixture(true);
      assert.equal(await companyTrusted(db(), key), false);
      const waiting = await create();
      assert.equal('autoPublished' in waiting && waiting.autoPublished, false);
      assert.equal((await job(waiting.id)).status, 'pending');
      await fixture(true);
      assert.equal(await companyTrusted(db(), key), true);
      const published = await create();
      assert.equal('autoPublished' in published && published.autoPublished, true);
      assert.equal((await job(published.id)).status, 'published');
      assert.ok((await job(published.id)).auto_published_at);
      assert.equal((await db().query("SELECT 1 FROM audit_log WHERE job_id=$1 AND action='auto_publish' AND actor='system'", [published.id])).rowCount, 1);
    });
    await t.test('recent rejection blocks auto; old rejection does not; test publications do not count', async () => {
      await db().query("INSERT INTO audit_log(job_id,action,actor) VALUES($1,'reject','test')", [ids[0]]);
      const pending = await fixture();
      assert.equal(await autoPublishIfTrusted(owner, pending), false);
      assert.equal((await job(pending)).status, 'pending');
      await db().query("UPDATE audit_log SET created_at=now()-interval '91 days' WHERE job_id=$1 AND action='reject'", [ids[0]]);
      assert.equal(await companyTrusted(db(), key), true);
      await db().query('UPDATE job_submissions SET is_test=true WHERE job_id=ANY($1::uuid[])', [ids]);
      assert.equal(await companyTrusted(db(), key), false);
      await db().query('UPDATE job_submissions SET is_test=false WHERE job_id=ANY($1::uuid[])', [ids]);
    });
    await t.test('manual off/on and approval, owner eligibility; invalid publication remains pending', async () => {
      await changeCompanyAccount({ id: owner.id, version: 1, action: 'trusted-mode', mode: 'off' });
      const pending = await fixture();
      assert.equal(await autoPublishIfTrusted(owner, pending), false);
      await changeCompanyAccount({ id: owner.id, version: 2, action: 'trusted-mode', mode: 'on' });
      assert.equal(await autoPublishIfTrusted(owner, pending), true);
      await db().query("UPDATE company_profiles SET approval_status='pending' WHERE company_key=$1", [key]);
      assert.equal(await companyTrusted(db(), key), false);
      await db().query("UPDATE company_profiles SET approval_status='approved' WHERE company_key=$1", [key]);
      await db().query('UPDATE company_accounts SET email_verified=false WHERE id=$1', [owner.id]);
      assert.equal(await companyTrusted(db(), key), false);
      await db().query('UPDATE company_accounts SET email_verified=true,enabled=false WHERE id=$1', [owner.id]);
      assert.equal(await companyTrusted(db(), key), false);
      await db().query('UPDATE company_accounts SET enabled=true WHERE id=$1', [owner.id]);
      const invalid = await fixture();
      await db().query("UPDATE job_submissions SET notification_email=NULL WHERE job_id=$1", [invalid]);
      assert.equal(await autoPublishIfTrusted(owner, invalid), false);
      assert.equal((await job(invalid)).status, 'pending');
      assert.equal((await job(invalid)).auto_published_at, null);
    });
    await t.test('VIP still waits and creates the existing invoice', async () => {
      const numeric = ('ZZ0000000000000000GE00').replace(/[A-Z]/g, c => String(c.charCodeAt(0) - 55));
      const iban = 'GE' + String(BigInt(98) - BigInt(numeric) % BigInt(97)).padStart(2, '0') + 'ZZ0000000000000000';
      await db().query(`INSERT INTO billing_settings(id,payee_name,bank_name,iban) VALUES(true,'TEST recipient','TEST bank',$1)
        ON CONFLICT(id) DO UPDATE SET payee_name=excluded.payee_name,bank_name=excluded.bank_name,iban=excluded.iban`, [iban]);
      const vip = await create('vip');
      assert.equal('autoPublished' in vip && vip.autoPublished, false);
      assert.ok('invoiceUrl' in vip && vip.invoiceUrl);
      assert.equal((await job(vip.id)).status, 'pending');
      assert.equal((await job(vip.id)).auto_published_at, null);
      assert.equal(await autoPublishIfTrusted(owner, vip.id), false);
      assert.equal((await db().query("SELECT 1 FROM job_invoices WHERE job_id=$1 AND placement_tier='vip' AND status='pending'", [vip.id])).rowCount, 1);
    });
    await t.test('admin queue disabled, initialization, concurrent dedupe, daily cap and next-day backlog', async () => {
      await db().query("DELETE FROM notification_state WHERE key='admin_review'");
      delete process.env.ADMIN_NOTIFY_EMAIL;
      await queueAdminNotifications(new Date('2098-06-10T08:00:00Z'));
      assert.equal((await db().query("SELECT 1 FROM notification_state WHERE key='admin_review'")).rowCount, 0);
      process.env.ADMIN_NOTIFY_EMAIL = 'admin@example.com';
      process.env.ADMIN_NOTIFY_DAILY_LIMIT = '1';
      const start = new Date('2098-06-10T08:00:00Z');
      await queueAdminNotifications(start);
      const state = async () => (await db().query("SELECT value FROM notification_state WHERE key='admin_review'")).rows[0].value;
      assert.equal((await state()).since, start.toISOString());
      assert.equal((await state()).sentToday, 0);
      const pending = await fixture();
      await db().query("UPDATE job_submissions SET created_at='2098-06-10T08:30:00Z' WHERE job_id=$1", [pending]);
      const published = ids[0];
      await db().query("UPDATE jobs SET auto_published_at='2098-06-10T08:30:00Z',auto_publish_reviewed_at=NULL WHERE id=$1", [published]);
      await db().query("UPDATE company_profiles SET approval_status='pending' WHERE company_key=$1", [key]);
      await db().query("UPDATE company_accounts SET created_at='2098-06-10T08:30:00Z' WHERE id=$1", [owner.id]);
      const now = new Date('2098-06-10T09:00:00Z');
      await Promise.all([queueAdminNotifications(now), queueAdminNotifications(now)]);
      assert.equal((await db().query('SELECT 1 FROM notification_emails WHERE dedupe_key=$1', [queueKeys[0]])).rowCount, 1);
      const email = (await db().query('SELECT payload FROM notification_emails WHERE dedupe_key=$1', [queueKeys[0]])).rows[0].payload;
      assert.match(email.text, /1 ახალი ვაკანსია და 1 კომპანიის ანგარიში/);
      assert.match(email.text, /1 ავტომატურად/);
      assert.equal((await state()).since, now.toISOString());
      await db().query("UPDATE company_profiles SET approval_status='approved' WHERE company_key=$1", [key]);
      const backlog = await fixture();
      await db().query("UPDATE job_submissions SET created_at='2098-06-10T09:30:00Z' WHERE job_id=$1", [backlog]);
      await queueAdminNotifications(new Date('2098-06-10T10:00:00Z'));
      assert.equal((await state()).since, now.toISOString());
      await queueAdminNotifications(new Date('2098-06-11T08:00:00Z'));
      assert.equal((await state()).sentToday, 1);
      assert.equal((await db().query('SELECT 1 FROM notification_emails WHERE dedupe_key=$1', [queueKeys[1]])).rowCount, 1);
    });
  } finally {
    await db().query('DELETE FROM notification_emails WHERE dedupe_key=ANY($1::text[])', [queueKeys]);
    if (oldState) await db().query("INSERT INTO notification_state(key,value,updated_at) VALUES('admin_review',$1,$2) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at", [oldState.value, oldState.updated_at]);
    else await db().query("DELETE FROM notification_state WHERE key='admin_review'");
    if (oldBilling) await db().query('UPDATE billing_settings SET payee_name=$1,bank_name=$2,iban=$3,updated_at=$4 WHERE id=true', [oldBilling.payee_name, oldBilling.bank_name, oldBilling.iban, oldBilling.updated_at]);
    else await db().query('DELETE FROM billing_settings WHERE id=true');
    await db().query('DELETE FROM source_items WHERE job_id=ANY($1::uuid[])', [ids]);
    await db().query('DELETE FROM google_indexing_queue WHERE job_id=ANY($1::uuid[])', [ids]);
    await db().query('DELETE FROM job_invoices WHERE job_id=ANY($1::uuid[])', [ids]);
    await db().query('DELETE FROM job_submissions WHERE job_id=ANY($1::uuid[])', [ids]);
    await db().query('DELETE FROM company_job_ownership WHERE company_key=$1', [key]);
    await db().query('DELETE FROM audit_log WHERE job_id=ANY($1::uuid[]) OR after_data->>\'companyKey\'=$2', [ids, key]);
    await db().query('DELETE FROM jobs WHERE id=ANY($1::uuid[])', [ids]);
    await db().query('DELETE FROM company_accounts WHERE company_key=$1', [key]);
    await db().query('DELETE FROM company_profiles WHERE company_key=$1', [key]);
    for (const [k, v] of previousEnv) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    await db().end();
  }
});
