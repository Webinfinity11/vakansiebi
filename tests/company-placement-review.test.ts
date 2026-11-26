import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { Client } from 'pg';
import { db, transaction } from '../lib/server/db';
import { changeCompanyJob, companyJobs } from '../lib/server/company-jobs';
import { createCompanyAccount } from '../lib/server/company-accounts';
import { upgradeCompanyJob, requestCompanyPlacement, companyBilling } from '../lib/server/company-billing';
import { mutateJob, adminJobs } from '../lib/server/jobs';
import { billingOverview, getInvoice } from '../lib/server/billing';
import { adminOverview } from '../lib/server/admin-overview';
import { employerContacts } from '../lib/server/employer-contacts';
import { purgeEnded } from '../worker/purge';
import { priorSubmission } from '../lib/server/job-submissions';
import { newCompanyJob } from '../lib/company-job-form';
import type { CompanyIdentity } from '../lib/company-portal';

test('pending vacancy placement orders are inactive, idempotent and cancelled on rejection',
  { skip: process.env.RUN_COMPANY_DB_TESTS !== '1' }, async () => {
    const original = process.env.DATABASE_URL!;
    const url = new URL(original);
    assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
    assert.equal(url.pathname, '/jobx_company_local');
    const schema = 'placement_review_' + randomUUID().replaceAll('-', '');
    const c = new Client({ connectionString: original });
    await c.connect();
    process.env.COMPANY_PORTAL_ENABLED = 'true';
    process.env.SESSION_SECRET = 'local-placement-review-test-secret-over-32-characters';
    process.env.INVOICE_EMAIL_ENABLED = 'false';
    try {
      await c.query(`CREATE SCHEMA ${schema}`);
      await c.query(`SET search_path TO ${schema}`);
      for (const file of readdirSync('db/migrations').filter(f => f.endsWith('.sql')).sort())
        await c.query(readFileSync('db/migrations/' + file, 'utf8'));
      // The history migration is safe to retry after an interrupted release.
      await c.query(readFileSync('db/migrations/093_job_invoice_history.sql', 'utf8'));
      url.searchParams.set('options', '-c search_path=' + schema);
      process.env.DATABASE_URL = url.href;
      await db().query('INSERT INTO billing_settings(payee_name,bank_name,iban) VALUES($1,$2,$3)',
        ['TEST ONLY recipient', 'TEST ONLY bank', 'GE98ZZ0000000000000000']);
      const { account } = await createCompanyAccount({ name: 'Placement review test',
        username: 'placement-review-test', email: 'placement-review@example.com', confirmed: true });
      await db().query('UPDATE company_accounts SET must_change_password=false,email_verified=true WHERE id=$1', [account.id]);
      await db().query("UPDATE company_profiles SET approval_status='approved' WHERE company_key=$1", [account.company_key]);
      const company: CompanyIdentity = {
        id: account.id, companyKey: account.company_key, name: 'Placement review test',
        username: 'placement-review-test', email: 'placement-review@example.com',
        mustChangePassword: false, role: 'owner', approvalStatus: 'approved',
        emailVerified: true, representativeName: 'TEST owner',
      };
      const requestId = randomUUID();
      const created = await changeCompanyJob(company, { action: 'create', requestId,
        form: { ...newCompanyJob(), title: 'შემოწმება review კონსულტანტი',
          description: 'მომხმარებელთან ურთიერთობა და პროდუქციის წარდგენა.', contact: company.email,
          deadline: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10) } });
      assert.ok('id' in created);
      const id = created.id;
      // Approved companies may publish automatically; exercise the moderation state explicitly.
      await db().query("UPDATE jobs SET status='pending',needs_review=true WHERE id=$1", [id]);
      const listed = async () => (await companyJobs(company)).find(job => job.id === id)!;
      let job = await listed();
      assert.equal(job.canOrderPlacement, true);
      const recruiter = { ...company, role: 'recruiter' as const };
      await assert.rejects(upgradeCompanyJob(recruiter, id, job.version, 'vip'), /მფლობელს/);
      const first = await upgradeCompanyJob(company, id, job.version, 'vip');
      assert.equal(first.invoice?.status, 'pending');
      assert.equal(first.invoice?.placementTier, 'vip');
      assert.equal(first.invoice?.activatedAt, null);
      assert.equal(first.invoiceUrl, first.invoice?.url);
      await assert.rejects(upgradeCompanyJob(company, id, job.version, 'vip'), /ჩანაწერი შეიცვალა/);
      job = await listed();
      assert.equal(job.status, 'pending');
      assert.equal(job.needsReview, true);
      assert.equal(job.placement, 'standard');
      assert.equal(job.placementExpiresAt, null);
      assert.equal(job.form.placement, 'vip');
      assert.equal(job.invoice?.token, first.invoice?.token);
      await assert.rejects(upgradeCompanyJob(recruiter, id, job.version, 'vip'), /მფლობელს/);
      const second = await upgradeCompanyJob(company, id, job.version, 'vip');
      assert.deepEqual(second.invoice, first.invoice);
      assert.equal(second.invoiceUrl, undefined);
      assert.equal((await db().query('SELECT count(*)::int n FROM job_invoices WHERE job_id=$1', [id])).rows[0].n, 1);
      const emails = (await db().query(
        'SELECT e.payload FROM invoice_email_delivery e JOIN job_invoices i ON i.id=e.invoice_id WHERE i.job_id=$1', [id])).rows;
      assert.equal(emails.length, 1);
      assert.deepEqual(emails[0].payload.to, [company.email]);
      assert.equal((await db().query("SELECT count(*)::int n FROM audit_log WHERE job_id=$1 AND action='company.placement_requested'", [id])).rows[0].n, 1);
      job = await listed();
      await mutateJob({ id, version: job.version, action: 'reject' });
      assert.equal((await listed()).invoice?.status, 'cancelled');
      job = await listed();
      await changeCompanyJob(company, { action: 'restore', id, version: job.version,
        form: { ...job.form, title: 'შემოწმება review გასწორებული კონსულტანტი' } });
      job = await listed();
      assert.equal(job.status, 'pending');
      assert.equal(job.canOrderPlacement, true);
      assert.match(job.title, /გასწორებული/);
      await transaction(c => requestCompanyPlacement(c, company, id, 'standard'));
      assert.equal((await db().query('SELECT requested_placement FROM job_submissions WHERE job_id=$1', [id])).rows[0].requested_placement, 'standard');
      // The job lock serializes concurrent orders even without the UI's version check.
      const orders = await Promise.all([0, 1].map(() => transaction(c =>
        requestCompanyPlacement(c, company, id, 'premium'))));
      assert.deepEqual(orders.map(order => order?.created).sort(), [false, true]);
      const replacement = orders[0]!.invoice;
      assert.notEqual(replacement.token, first.invoice?.token);
      assert.notEqual(replacement.number, first.invoice?.number);
      assert.equal((await getInvoice(first.invoice!.token)).status, 'cancelled');
      assert.equal((await listed()).invoice?.token, replacement.token);
      assert.equal((await priorSubmission(requestId))?.invoiceUrl, replacement.url);
      // An older cancelled invoice must not downgrade the new pending order on free restore.
      await transaction(c => requestCompanyPlacement(c, company, id, 'standard'));
      assert.equal((await db().query('SELECT requested_placement FROM job_submissions WHERE job_id=$1', [id])).rows[0].requested_placement, 'premium');
      const history = (await companyBilling(company)).invoices;
      assert.equal(history.length, 2);
      assert.deepEqual(history.map(i => i.status).sort(), ['cancelled', 'pending']);
      assert.equal((await adminJobs('all', '', 1, '', id)).jobs[0].invoice.token, replacement.token);
      assert.equal((await employerContacts()).find(c => c.key === company.companyKey)?.jobs.length, 1);
      // Enforce the invariant in PostgreSQL too, independent of application locks.
      await assert.rejects(db().query(`INSERT INTO job_invoices
        (id,token,job_id,amount_gel,service_days,payer_name,vacancy_title,payee_name,bank_name,iban,placement_tier)
        SELECT $1,$2,job_id,amount_gel,service_days,payer_name,vacancy_title,payee_name,bank_name,iban,placement_tier
        FROM job_invoices WHERE token=$3`, [randomUUID(), 'f'.repeat(64), replacement.token]),
      (error: unknown) => (error as { code?: string }).code === '23505');
      assert.equal((await billingOverview()).totals.awaiting_count, 1);
      assert.equal((await adminOverview(7)).revenue.awaiting, 50);
      // Moderation selects the current invoice and writes by its ID, leaving history intact.
      await mutateJob({ id, version: (await listed()).version, action: 'confirm-payment' });
      assert.equal((await getInvoice(replacement.token)).status, 'paid');
      assert.equal((await getInvoice(first.invoice!.token)).status, 'cancelled');
      await mutateJob({ id, version: (await listed()).version, action: 'publish' });
      assert.ok((await getInvoice(replacement.token)).activated_at);
      assert.equal((await getInvoice(first.invoice!.token)).activated_at, null);
      assert.equal((await billingOverview()).placements.filter(p => p.id === id).length, 1);
      assert.equal((await listed()).canOrderPlacement, false);
      await assert.rejects(upgradeCompanyJob(company, id, (await listed()).version, 'vip'), /ინვოისი უკვე/);
      // While the paid placement is active a manual order is refused, also for the same tier.
      await assert.rejects(upgradeCompanyJob(company, id, (await listed()).version, 'premium'), /ინვოისი უკვე/);
      assert.equal((await companyBilling(company)).invoices.length, 2);
      // Archiving cannot cancel an already activated payment or remove its invoice history.
      await mutateJob({ id, version: (await listed()).version, action: 'archive' });
      await db().query("UPDATE jobs SET updated_at=now()-interval '60 days' WHERE id=$1", [id]);
      const purge = await purgeEnded();
      assert.equal(purge.editor, 0);
      assert.equal((await getInvoice(replacement.token)).status, 'paid');
      await assert.rejects(upgradeCompanyJob(company, id, (await listed()).version, 'vip'), /დახურული/);
    } finally {
      await db().end();
      process.env.DATABASE_URL = original;
      await c.query(`DROP SCHEMA ${schema} CASCADE`);
      await c.end();
    }
  });
