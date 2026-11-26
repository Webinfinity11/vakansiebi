import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { Client } from 'pg';
import { db, transaction } from '../lib/server/db';
import { submitJob } from '../lib/server/job-submissions';
import { mutateJob, publicJobs } from '../lib/server/jobs';
import { runNotificationJobs } from '../lib/server/notification-jobs';
import { createInvoiceDetails } from '../lib/server/billing';
import { requestCompanyPlacement } from '../lib/server/company-billing';
import { companyJobs } from '../lib/server/company-jobs';
import type { CompanyIdentity } from '../lib/company-portal';
import { placementDeadline } from '../lib/placement-deadline';
import { paidPlacementPrices, vipDays, premiumDays } from '../lib/billing';

const DAY = 86400000;
test('placement renewals: one invoice/mail per period, opt-out, activation and expiry',
  { skip: process.env.RUN_COMPANY_DB_TESTS !== '1' }, async t => {
    const original = process.env.DATABASE_URL!;
    const url = new URL(original);
    assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
    assert.equal(url.pathname, '/jobx_company_local');
    const schema = 'placement_renewal_' + randomUUID().replaceAll('-', '');
    const c = new Client({ connectionString: original });
    await c.connect();
    const oldEmail = process.env.NOTIFICATION_EMAIL_ENABLED;
    process.env.NOTIFICATION_EMAIL_ENABLED = 'false';
    process.env.SESSION_SECRET = 'local-placement-renewal-test-secret-over-32-characters';
    try {
      await c.query(`CREATE SCHEMA ${schema}`);
      await c.query(`SET search_path TO ${schema}`);
      for (const file of readdirSync('db/migrations').filter(f => f.endsWith('.sql')).sort())
        await c.query(readFileSync('db/migrations/' + file, 'utf8'));
      url.searchParams.set('options', '-c search_path=' + schema);
      process.env.DATABASE_URL = url.href;
      await db().query('INSERT INTO billing_settings(payee_name,bank_name,iban) VALUES($1,$2,$3)',
        ['TEST ONLY recipient', 'TEST ONLY bank', 'GE98ZZ0000000000000000']);
      const now = new Date();
      const read = async (id: string) => (await db().query('SELECT * FROM jobs WHERE id=$1', [id])).rows[0];
      const act = async (id: string, action: string) => mutateJob({ id, version: (await read(id)).version, action });
      const invoices = async (id: string) => (await db().query('SELECT * FROM job_invoices WHERE job_id=$1 ORDER BY number', [id])).rows;
      const run = (key: string, at = now) => runNotificationJobs(at, { companyKey: key, deliver: false });
      async function fixture(tier: 'vip' | 'premium' | 'standard' = 'vip', days = 3, enabled = true) {
        const key = 'renewal-' + randomUUID();
        const submitted = await submitJob({
          requestId: randomUUID(), placement: tier, title: 'TEST renewal', company: key,
          category: 'ტექნოლოგიები', city: 'თბილისი', mode: 'ადგილზე', employmentType: 'სრული განაკვეთი',
          salaryFrom: '', salaryTo: '', salaryPeriod: 'თვე', deadline: placementDeadline(undefined, now, 60),
          description: 'Isolated local renewal fixture. No real vacancy, payment or recipient.',
          contact: 'test@example.com', notificationEmail: 'test@example.com', billingEmail: '', consent: true, fax: '',
        }, 'renewal-test-' + randomUUID());
        const id = submitted.id;
        if (tier !== 'standard') await act(id, 'confirm-payment');
        await act(id, 'publish');
        const expiry = new Date(now.getTime() + days * DAY);
        if (tier !== 'standard') await db().query('UPDATE jobs SET placement_expires_at=$2 WHERE id=$1', [id, expiry]);
        await db().query("INSERT INTO company_profiles(company_key,name) VALUES($1,'Renewal test')", [key]);
        await db().query(`INSERT INTO company_accounts(id,company_key,username,email,password_hash,role,email_verified)
          VALUES($1,$2,$2,$3,'unused','owner',true)`, [randomUUID(), key, `${key}@example.com`]);
        await db().query('INSERT INTO company_job_ownership(job_id,company_key) VALUES($1,$2)', [id, key]);
        await db().query(`INSERT INTO company_notification_settings(company_key,application_mode,deadline_reminders)
          VALUES($1,'off',$2)`, [key, enabled]);
        return { id, key, expiry };
      }
      await t.test('three days creates one combined email and invoice; concurrent reruns do nothing', async () => {
        const f = await fixture('premium');
        const invoiceMailBefore = (await db().query('SELECT count(*)::int n FROM invoice_email_delivery')).rows[0].n;
        await Promise.all([run(f.key), run(f.key)]);
        const all = await invoices(f.id);
        assert.equal(all.length, 2);
        assert.equal(all[1].amount_gel, paidPlacementPrices.premium);
        assert.equal(all[1].service_days, premiumDays);
        assert.equal(all[1].renewal_for_expires_at.getTime(), f.expiry.getTime());
        const dto = (await companyJobs({ companyKey: f.key, approvalStatus: 'pending' } as CompanyIdentity)).find(j => j.id === f.id)!;
        assert.equal(new Date(dto.invoice!.renewal_for_expires_at!).getTime(), f.expiry.getTime());
        const mail = (await db().query('SELECT * FROM notification_emails WHERE dedupe_key=$1',
          [`placement-renewal:${f.id}:${f.expiry.toISOString()}`])).rows;
        assert.equal(mail.length, 1);
        assert.match(mail[0].payload.subject, /TEST renewal/);
        assert.match(mail[0].payload.html, /TEST renewal/);
        assert.match(mail[0].payload.text, new RegExp(`/invoices/${all[1].token}`));
        assert.equal((await db().query('SELECT count(*)::int n FROM invoice_email_delivery')).rows[0].n, invoiceMailBefore);
        // Even after manual cancellation, this expiry must never get another invoice.
        await db().query("UPDATE job_invoices SET status='cancelled' WHERE id=$1", [all[1].id]);
        await run(f.key);
        assert.equal((await invoices(f.id)).length, 2);
      });
      await t.test('email construction failure rolls back the invoice and audit together', async () => {
        const f = await fixture();
        const appUrl = process.env.APP_URL;
        try {
          process.env.APP_URL = 'javascript:invalid';
          await assert.rejects(run(f.key));
          assert.equal((await invoices(f.id)).length, 1);
          assert.equal((await db().query("SELECT count(*)::int n FROM audit_log WHERE job_id=$1 AND action='placement.renewal_requested'", [f.id])).rows[0].n, 0);
        } finally {
          if (appUrl === undefined) delete process.env.APP_URL; else process.env.APP_URL = appUrl;
        }
      });
      await t.test('four days, disabled setting, free vacancy, unapproved company and manual pending order create nothing', async () => {
        for (const scenario of ['four', 'off', 'free', 'unapproved', 'manual'] as const) {
          const f = await fixture(scenario === 'free' ? 'standard' : 'vip', scenario === 'four' ? 4 : 3, scenario !== 'off');
          if (scenario === 'free') await db().query(`UPDATE jobs SET published=jsonb_set(published,'{deadline}',to_jsonb($2::text)) WHERE id=$1`, [f.id, placementDeadline(undefined, now, 2)]);
          if (scenario === 'unapproved') await db().query("UPDATE company_profiles SET approval_status='pending' WHERE company_key=$1", [f.key]);
          if (scenario === 'manual') await transaction(c => createInvoiceDetails(c, { id: f.id, company: f.key, title: 'Test', billingEmail: 'owner@example.com', placement: 'vip' }));
          const before = (await invoices(f.id)).length;
          await run(f.key);
          assert.equal((await invoices(f.id)).length, before, scenario);
          assert.equal((await db().query('SELECT count(*)::int n FROM notification_emails WHERE dedupe_key LIKE $1', [`%${f.id}%`])).rows[0].n, 0, scenario);
        }
      });
      await t.test('payment before expiry preserves remaining days; reapproval is idempotent', async () => {
        const f = await fixture();
        await run(f.key);
        await act(f.id, 'publish'); // A pending renewal does not block unrelated edits.
        assert.equal((await read(f.id)).placement_expires_at.getTime(), f.expiry.getTime());
        await act(f.id, 'confirm-payment');
        await act(f.id, 'publish');
        const job = await read(f.id);
        assert.equal(job.placement_expires_at.getTime(), f.expiry.getTime() + vipDays * DAY);
        assert.equal(job.placement_tier, 'vip');
        assert.ok(job.published.deadline >= placementDeadline(undefined, job.placement_expires_at, 0));
        await act(f.id, 'publish');
        assert.equal((await read(f.id)).placement_expires_at.getTime(), job.placement_expires_at.getTime());
      });
      await t.test('payment two days after expiry starts at confirmation, deadline follows', async () => {
        const f = await fixture('vip', -2);
        await run(f.key, new Date(f.expiry.getTime() - DAY));
        await db().query(`UPDATE jobs SET draft=jsonb_set(draft,'{deadline}',to_jsonb($2::text)),
          published=jsonb_set(published,'{deadline}',to_jsonb($2::text)) WHERE id=$1`, [f.id, placementDeadline(undefined, f.expiry, 0)]);
        await act(f.id, 'confirm-payment');
        const invoice = (await invoices(f.id))[1];
        await act(f.id, 'publish');
        const job = await read(f.id);
        assert.equal(job.placement_expires_at.getTime(), invoice.paid_at.getTime() + vipDays * DAY);
        assert.equal(job.published.deadline, placementDeadline(undefined, invoice.paid_at, vipDays));
      });
      for (const cancelledRenewal of [false, true]) await t.test(`expired placement, cancelled renewal=${cancelledRenewal}: one new order and full activation term`, async () => {
        const f = await fixture('vip', -8);
        if (cancelledRenewal) {
          await run(f.key, new Date(f.expiry.getTime() - DAY));
          await run(f.key);
          assert.equal((await invoices(f.id))[1].status, 'cancelled');
        } else {
          assert.equal((await invoices(f.id)).length, 1);
          assert.ok((await invoices(f.id))[0].activated_at);
        }
        await db().query('UPDATE company_accounts SET must_change_password=false WHERE company_key=$1', [f.key]);
        const account = (await db().query('SELECT * FROM company_accounts WHERE company_key=$1', [f.key])).rows[0];
        const owner: CompanyIdentity = {
          id: account.id, companyKey: f.key, name: f.key, username: account.username,
          email: account.email, role: 'owner', approvalStatus: 'approved', emailVerified: true,
          mustChangePassword: false, representativeName: 'Test',
        };
        const listed = () => companyJobs(owner).then(jobs => jobs.find(j => j.id === f.id)!);
        assert.equal((await listed()).canOrderPlacement, true);
        if (!cancelledRenewal) {
          assert.ok((await listed()).invoice?.activated_at);
          for (const status of ['refunded', 'refund_required']) {
            await db().query('UPDATE job_invoices SET status=$2 WHERE job_id=$1', [f.id, status]);
            assert.equal((await listed()).canOrderPlacement, false);
            await assert.rejects(transaction(c => requestCompanyPlacement(c, owner, f.id, 'vip')), /ინვოისი უკვე/);
          }
          await db().query("UPDATE job_invoices SET status='paid' WHERE job_id=$1", [f.id]);
        }
        const results = await Promise.all([1, 2].map(() => transaction(c => requestCompanyPlacement(c, owner, f.id, 'vip'))));
        assert.equal(results.filter(r => r?.created).length, 1);
        assert.equal(results[0]?.invoice.token, results[1]?.invoice.token);
        const pending = (await invoices(f.id)).filter(i => i.status === 'pending');
        assert.equal(pending.length, 1);
        assert.equal(pending[0].renewal_for_expires_at, null);
        assert.equal((await listed()).invoice?.renewal_for_expires_at, null);
        assert.equal((await companyJobs(owner)).find(j => j.id === f.id)?.canOrderPlacement, false);
        await act(f.id, 'confirm-payment');
        assert.equal((await companyJobs(owner)).find(j => j.id === f.id)?.canOrderPlacement, false);
        await assert.rejects(transaction(c => requestCompanyPlacement(c, owner, f.id, 'premium')), /ინვოისი უკვე/);
        assert.equal((await transaction(c => requestCompanyPlacement(c, owner, f.id, 'vip')))?.created, false);
        await act(f.id, 'publish');
        await assert.rejects(transaction(c => requestCompanyPlacement(c, owner, f.id, 'vip')), /ინვოისი უკვე/);
        const fresh = (await invoices(f.id)).at(-1)!;
        assert.equal((await read(f.id)).placement_expires_at.getTime(), fresh.activated_at.getTime() + vipDays * DAY);
        assert.equal((await companyJobs(owner)).find(j => j.id === f.id)?.canOrderPlacement, false);
      });
      await t.test('unpaid renewal cancels at seven days even with reminders disabled; published vacancy loses boost', async () => {
        const f = await fixture('vip', -7);
        await run(f.key, new Date(f.expiry.getTime() - DAY));
        await run(f.key, new Date(f.expiry.getTime() + 7 * DAY - 1));
        assert.equal((await invoices(f.id))[1].status, 'pending');
        await assert.rejects(act(f.id, 'confirm-payment'), /გადახდის ვადა/);
        await db().query('UPDATE company_notification_settings SET deadline_reminders=false WHERE company_key=$1', [f.key]);
        await run(f.key, new Date(f.expiry.getTime() + 7 * DAY));
        assert.equal((await invoices(f.id))[1].status, 'cancelled');
        assert.equal((await read(f.id)).status, 'published');
        const publicResult = await publicJobs(new URLSearchParams({ ids: f.id }));
        assert.equal(publicResult.total, 1);
        assert.equal(publicResult.jobs[0].placement, undefined);
        assert.equal((await db().query("SELECT count(*)::int n FROM audit_log WHERE job_id=$1 AND action='placement.renewal_cancelled'", [f.id])).rows[0].n, 1);
        await run(f.key);
        assert.equal((await invoices(f.id)).length, 2);
      });
    } finally {
      await db().end();
      process.env.DATABASE_URL = original;
      if (oldEmail === undefined) delete process.env.NOTIFICATION_EMAIL_ENABLED; else process.env.NOTIFICATION_EMAIL_ENABLED = oldEmail;
      await c.query(`DROP SCHEMA ${schema} CASCADE`);
      await c.end();
    }
  });
