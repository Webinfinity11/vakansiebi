import test from 'node:test';
import assert from 'node:assert/strict';
import type { PoolClient } from 'pg';
import type { CompanyIdentity } from '../lib/company-portal';
import { requestCompanyPlacement } from '../lib/server/company-billing';
import { createInvoice } from '../lib/server/billing';
import { approvePlacement } from '../lib/server/job-placement';
import {
  validGeorgianIban,
  paidPlacementPrices,
  vipDays,
  premiumDays,
} from '../lib/billing';

const company: CompanyIdentity = {
  id: '00000000-0000-4000-8000-000000000001',
  companyKey: 'test-company',
  name: 'TEST company',
  username: 'test',
  email: 'owner@example.com',
  mustChangePassword: false,
  role: 'owner',
  approvalStatus: 'approved',
  emailVerified: true,
  representativeName: 'TEST owner',
};
const jobId = '00000000-0000-4000-8000-000000000002';
const bban = 'ZZ0000000000000000';
const numeric = (bban + 'GE00').replace(/[A-Z]/g, (c) =>
  String(c.charCodeAt(0) - 55),
);
const iban =
  'GE' +
  String(BigInt(98) - (BigInt(numeric) % BigInt(97))).padStart(2, '0') +
  bban;
const settings = { payee_name: 'TEST recipient', bank_name: 'TEST bank', iban };

type Call = { sql: string; values: unknown[] };
function client(
  options: {
    missingJob?: boolean;
    imported?: boolean;
    disabledAccount?: boolean;
    missingSettings?: boolean;
    status?: string;
    invoice?: Record<string, unknown>;
    active?: boolean;
  } = {},
) {
  const calls: Call[] = [];
  const c = {
    query: async (sql: string, values: unknown[] = []) => {
      calls.push({ sql, values });
      let rows: Record<string, unknown>[] = [];
      if (sql.includes('SELECT j.*'))
        rows = options.missingJob
          ? []
          : [
              {
                id: jobId,
                draft: { title: 'TEST vacancy' },
                status: options.status ?? 'published',
                requested_placement: options.imported ? null : 'standard',
                placement_expires_at: options.active
                  ? new Date(Date.now() + 86400000)
                  : null,
              },
            ];
      else if (sql.includes('SELECT token,status,placement_tier'))
        rows = options.invoice ? [options.invoice] : [];
      else if (sql.includes('SELECT 1 FROM company_accounts'))
        rows = options.disabledAccount ? [] : [{}];
      else if (sql.includes('FROM billing_settings'))
        rows = options.missingSettings ? [] : [settings];
      else if (sql.includes('INSERT INTO job_invoices'))
        rows = [
          {
            id: values[0],
            token: values[1],
            job_id: values[2],
            amount_gel: values[3],
            service_days: values[4],
            payer_name: values[5],
            vacancy_title: values[6],
            payee_name: values[7],
            bank_name: values[8],
            iban: values[9],
            placement_tier: values[10],
            number: '42',
            status: 'pending',
            created_at: new Date().toISOString(),
            paid_at: null,
            activated_at: null,
          },
        ];
      return { rows, rowCount: rows.length };
    },
  } as unknown as PoolClient;
  return { c, calls };
}

for (const tier of ['vip', 'premium'] as const) {
  test(`${tier}: company order uses fixed invoice terms and queues mail without activating placement`, async () => {
    assert.ok(validGeorgianIban(iban));
    const { c, calls } = client();
    const url = await requestCompanyPlacement(c, company, jobId, tier);
    assert.match(url!, /^\/invoices\/[a-f0-9]{64}$/);
    const insert = calls.find((call) =>
      call.sql.includes('INSERT INTO job_invoices'),
    )!;
    assert.equal(insert.values[3], paidPlacementPrices[tier]);
    assert.equal(insert.values[4], tier === 'vip' ? vipDays : premiumDays);
    assert.equal(insert.values[10], tier);
    assert.ok(
      calls.some((call) =>
        call.sql.includes('INSERT INTO invoice_email_delivery'),
      ),
    );
    const mail = calls.find((call) =>
      call.sql.includes('INSERT INTO invoice_email_delivery'),
    )!.values[1] as { to: string[] };
    assert.deepEqual(mail.to, [company.email]);
    assert.ok(
      calls.some(
        (call) =>
          call.sql.includes('UPDATE job_submissions') &&
          call.values[1] === tier,
      ),
    );
    assert.ok(calls.some((call) => call.sql.includes('needs_review=true')));
    assert.ok(
      !calls.some((call) =>
        /SET placement_tier|activated_at=|status='paid'/.test(call.sql),
      ),
    );
  });
}

test('existing invoices are immutable and retries never generate a second invoice', async () => {
  for (const status of ['pending', 'paid']) {
    const { c, calls } = client({
      invoice: { token: 'a'.repeat(64), status, placement_tier: 'vip' },
    });
    assert.equal(
      await requestCompanyPlacement(c, company, jobId, 'vip'),
      undefined,
    );
    assert.ok(!calls.some((call) => call.sql.includes('INSERT INTO')));
    await assert.rejects(
      requestCompanyPlacement(c, company, jobId, 'premium'),
      /ინვოისი უკვე/,
    );
  }
  for (const status of ['cancelled', 'refunded', 'refund_required']) {
    const { c } = client({
      invoice: { token: 'a'.repeat(64), status, placement_tier: 'vip' },
    });
    await assert.rejects(
      requestCompanyPlacement(c, company, jobId, 'vip'),
      /ინვოისი უკვე/,
    );
  }
});

test('new orders reject another company vacancy, imported/closed jobs, inactive accounts and recruiters', async () => {
  for (const [options, message] of [
    [{ missingJob: true }, /ვერ მოიძებნა/],
    [{ imported: true }, /მხოლოდ JOBX/],
    [{ status: 'archived' }, /დახურული/],
    [{ disabledAccount: true }, /წვდომა/],
    [{ active: true }, /უკვე გაცემულია/],
    [{ missingSettings: true }, /რეკვიზიტები/],
  ] as const) {
    const { c, calls } = client(options);
    await assert.rejects(
      requestCompanyPlacement(c, company, jobId, 'vip'),
      message,
    );
    assert.ok(
      !calls.some((call) => call.sql.includes('INSERT INTO job_invoices')),
    );
  }
  const { c, calls } = client();
  await assert.rejects(
    requestCompanyPlacement(c, { ...company, role: 'recruiter' }, jobId, 'vip'),
    /მფლობელს/,
  );
  assert.ok(
    !calls.some((call) => call.sql.includes('INSERT INTO job_invoices')),
  );
});

test('new orders require approved company and verified email', async () => {
  for (const identity of [
    { ...company, approvalStatus: 'pending' as const },
    { ...company, emailVerified: false },
  ]) {
    const { c, calls } = client();
    await assert.rejects(
      requestCompanyPlacement(c, identity, jobId, 'vip'),
      /დადასტურება/,
    );
    assert.ok(
      !calls.some((call) => call.sql.includes('INSERT INTO job_invoices')),
    );
  }
});

test('free restore only resets terminal unused orders and never cancels a payable invoice', async () => {
  const { c, calls } = client();
  assert.equal(
    await requestCompanyPlacement(c, company, jobId, 'standard'),
    undefined,
  );
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /activated_at IS NULL/);
  assert.match(calls[0].sql, /cancelled.*refunded.*refund_required/);
  assert.match(calls[0].sql, /company_key=\$2/);
});

test('public invoice creation still rejects missing bank details', async () => {
  const { c, calls } = client({ missingSettings: true });
  await assert.rejects(
    createInvoice(c, {
      id: jobId,
      title: 'TEST',
      company: company.name,
      billingEmail: company.email,
      placement: 'premium',
    }),
    /რეკვიზიტები/,
  );
  assert.equal(calls.length, 1);
});

test('moderation still requires a paid invoice and never resets an already activated expiry', async () => {
  for (const status of ['pending', 'paid']) {
    const calls: string[] = [];
    const c = {
      query: async (sql: string) => {
        calls.push(sql);
        if (sql.includes('FROM job_submissions')) return { rows: [{}] };
        if (sql.includes('FROM job_invoices'))
          return {
            rows: [
              {
                id: 'invoice',
                status,
                placement_tier: 'vip',
                amount_gel: paidPlacementPrices.vip,
                service_days: vipDays,
                activated_at: new Date(),
              },
            ],
          };
        throw Error('Unexpected mutation: ' + sql);
      },
    } as unknown as PoolClient;
    const job = {
      id: jobId,
      placement_tier: 'vip' as const,
      placement_expires_at: new Date(Date.now() + 86400000),
    };
    if (status === 'pending')
      await assert.rejects(
        approvePlacement(c, job, company.name, 'vip'),
        /ჩარიცხვა/,
      );
    else await approvePlacement(c, job, company.name, 'vip');
    assert.equal(calls.length, 2);
  }
});
