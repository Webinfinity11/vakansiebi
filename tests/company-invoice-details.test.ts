import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { Client } from 'pg';
import { invoiceDetails, validGeorgianIban, type JobInvoice } from '../lib/billing';
import { db } from '../lib/server/db';
import { changeCompanyJob, companyJobs } from '../lib/server/company-jobs';
import { createCompanyAccount } from '../lib/server/company-accounts';
import { newCompanyJob } from '../lib/company-job-form';
import type { CompanyIdentity } from '../lib/company-portal';

const iban = 'GE98ZZ0000000000000000';
const row: JobInvoice = {
  id: 'invoice', number: '42', token: 'a'.repeat(64), job_id: 'job',
  amount_gel: 20, service_days: 30, placement_tier: 'vip',
  payer_name: 'TEST payer', vacancy_title: 'TEST vacancy',
  payee_name: 'TEST ONLY recipient', bank_name: 'TEST ONLY bank', iban,
  status: 'pending', created_at: '2026-11-26T12:00:00+04:00', paid_at: null, activated_at: null,
};

test('invoiceDetails formats the number and serializes immutable payment details', () => {
  assert.ok(validGeorgianIban(iban));
  assert.deepEqual(invoiceDetails(row, '/invoice-test'), {
    url: '/invoice-test', token: row.token, number: '000042', amountGel: 20,
    serviceDays: 30, placementTier: 'vip', payeeName: row.payee_name,
    bankName: row.bank_name, iban, status: 'pending',
    createdAt: '2026-11-26T08:00:00.000Z', paidAt: null, activatedAt: null,
  });
  const paid = invoiceDetails({ ...row, placement_tier: undefined, status: 'paid',
    paid_at: '2026-11-26T13:00:00+04:00', activated_at: '2026-11-26T14:00:00+04:00',
  }, '/legacy');
  assert.equal(paid.placementTier, 'premium');
  assert.equal(paid.paidAt, '2026-11-26T09:00:00.000Z');
  assert.equal(paid.activatedAt, '2026-11-26T10:00:00.000Z');
  assert.throws(() => invoiceDetails({ ...row, number: '1000000' }, '/invalid'));
});

test('paid company vacancies expose one stable invoice across creation, saves and listing',
  { skip: process.env.RUN_COMPANY_DB_TESTS !== '1' }, async () => {
    const original = process.env.DATABASE_URL!;
    const url = new URL(original);
    assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
    assert.equal(url.pathname, '/jobx_company_local');
    const schema = 'invoice_details_' + randomUUID().replaceAll('-', '');
    const c = new Client({ connectionString: original });
    await c.connect();
    process.env.COMPANY_PORTAL_ENABLED = 'true';
    process.env.SESSION_SECRET = 'local-invoice-details-test-secret-over-32-characters';
    process.env.INVOICE_EMAIL_ENABLED = 'false';
    try {
      await c.query(`CREATE SCHEMA ${schema}`);
      await c.query(`SET search_path TO ${schema}`);
      for (const file of readdirSync('db/migrations').filter(f => f.endsWith('.sql')).sort())
        await c.query(readFileSync('db/migrations/' + file, 'utf8'));
      url.searchParams.set('options', '-c search_path=' + schema);
      process.env.DATABASE_URL = url.href;
      await db().query('INSERT INTO billing_settings(payee_name,bank_name,iban) VALUES($1,$2,$3)',
        [row.payee_name, row.bank_name, iban]);
      const { account } = await createCompanyAccount({ name: 'Invoice details test',
        username: 'invoice-details-test', email: 'invoice-details@example.com', confirmed: true });
      await db().query('UPDATE company_accounts SET must_change_password=false,email_verified=true WHERE id=$1', [account.id]);
      await db().query("UPDATE company_profiles SET approval_status='approved' WHERE company_key=$1", [account.company_key]);
      const company: CompanyIdentity = {
        id: account.id, companyKey: account.company_key, name: 'Invoice details test',
        username: 'invoice-details-test', email: 'invoice-details@example.com',
        mustChangePassword: false, role: 'owner', approvalStatus: 'approved',
        emailVerified: true, representativeName: 'TEST owner',
      };
      for (const placement of ['vip', 'premium'] as const) {
        const form = { ...newCompanyJob(), title: 'კონსულტანტი ' + placement,
          description: 'მომხმარებელთან ურთიერთობა და პროდუქციის წარდგენა.',
          contact: company.email, placement,
          deadline: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10) };
        const result = await changeCompanyJob(company, { action: 'create', requestId: randomUUID(), form });
        assert.ok('invoice' in result && result.invoice);
        assert.ok('id' in result);
        const invoice = result.invoice;
        assert.match(invoice.number, /^\d{6}$/);
        assert.equal(invoice.amountGel, placement === 'vip' ? 20 : 50);
        assert.equal(invoice.serviceDays, 30);
        assert.equal(invoice.iban, iban);
        assert.equal(invoice.placementTier, placement);
        assert.equal(typeof invoice.createdAt, 'string');
        assert.equal('invoiceUrl' in result && result.invoiceUrl, invoice.url);
        let listed = (await companyJobs(company)).find(j => j.id === result.id)!;
        for (const selected of [placement, 'standard'] as const) {
          const saved = await changeCompanyJob(company, { action: 'save', id: listed.id,
            version: listed.version, form: { ...form, placement: selected } });
          assert.ok('invoice' in saved);
          assert.deepEqual(saved.invoice, invoice);
          assert.equal('invoiceUrl' in saved && saved.invoiceUrl !== undefined, false);
          listed = (await companyJobs(company)).find(j => j.id === result.id)!;
        }
        assert.deepEqual(listed.invoice, {
          status: 'pending', token: invoice.token, placement_tier: placement,
          number: invoice.number, amount_gel: invoice.amountGel, service_days: 30,
          payee_name: row.payee_name, bank_name: row.bank_name, iban,
          created_at: listed.invoice!.created_at, activated_at: null, renewal_for_expires_at: null,
        });
        assert.equal(new Date(listed.invoice!.created_at).toISOString(), invoice.createdAt);
        const count = (await db().query('SELECT count(*)::int n FROM job_invoices WHERE job_id=$1', [listed.id])).rows[0].n;
        assert.equal(count, 1);
      }
    } finally {
      await db().end();
      process.env.DATABASE_URL = original;
      await c.query(`DROP SCHEMA ${schema} CASCADE`);
      await c.end();
    }
  });
