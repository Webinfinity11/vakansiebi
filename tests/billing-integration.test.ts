import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { db } from '../lib/server/db';
import { submitJob } from '../lib/server/job-submissions';
import { mutateJob, publicJobs } from '../lib/server/jobs';
import { getInvoice } from '../lib/server/billing';
import { submissionDate } from '../lib/job-submission';
import { validGeorgianIban, invoiceNumber } from '../lib/billing';

void test('invoice numbers and Georgian account checks reject broken details', () => {
  assert.equal(invoiceNumber(4, '2026-09-15'), 'JOBX-2026-000004');
  assert.equal(validGeorgianIban('GE00ZZ0000000000000000'), false);
  assert.equal(validGeorgianIban('invalid'), false);
});
void test(
  'premium needs a private fixed-price invoice, payment approval, and never renews on editing',
  { skip: process.env.RUN_DB_TESTS !== '1' },
  async () => {
    assert.equal(new URL(process.env.DATABASE_URL!).pathname, '/ertad_test');
    process.env.SESSION_SECRET ||=
      'isolated-submission-test-secret-at-least-32-characters';
    const ids: string[] = [];
    const old = (await db().query('SELECT * FROM billing_settings')).rows[0];
    const bban = 'ZZ0000000000000000';
    const rearranged = (bban + 'GE00').replace(/[A-Z]/g, (c) =>
      String(c.charCodeAt(0) - 55),
    );
    const iban =
      'GE' +
      String(BigInt(98) - (BigInt(rearranged) % BigInt(97))).padStart(2, '0') +
      bban;
    assert.equal(validGeorgianIban(iban), true);
    const key = 'INVOICETEST' + randomUUID();
    const payload = {
      requestId: randomUUID(),
      placement: 'premium',
      title: key,
      company: key,
      category: 'ტექნოლოგიები',
      city: 'თბილისი',
      mode: 'ადგილზე',
      employmentType: 'სრული განაკვეთი',
      salaryFrom: '',
      salaryTo: '',
      salaryPeriod: 'თვე',
      deadline: submissionDate(new Date(Date.now() + 30 * 86400000)),
      description:
        'This is an isolated test vacancy for verifying bank transfer invoices and moderation. No actual job, customer or payment is involved.',
      contact: 'hr@example.com',
      consent: true,
      fax: '',
    };
    try {
      await db().query('DELETE FROM billing_settings');
      await assert.rejects(submitJob(payload, key), /რეკვიზიტები/);
      assert.equal(
        (
          await db().query(
            "SELECT count(*)::int total FROM jobs WHERE draft->>'title'=$1",
            [key],
          )
        ).rows[0].total,
        0,
        'missing billing details rolls back the submission',
      );
      await db().query(
        'INSERT INTO billing_settings(id,payee_name,bank_name,iban) VALUES(true,$1,$2,$3)',
        ['TEST recipient', 'TEST bank', iban],
      );
      const received = await submitJob(
        { ...payload, amount_gel: 1, paid: true },
        key,
      );
      ids.push(received.id);
      assert.ok(received.invoiceUrl);
      const retry = await submitJob(payload, key);
      assert.equal(retry.invoiceUrl, received.invoiceUrl);
      const token = received.invoiceUrl!.split('/').pop()!;
      let inv = await getInvoice(token);
      assert.equal(inv.amount_gel, 20);
      assert.equal(inv.service_days, 14);
      assert.equal(inv.status, 'pending');
      assert.equal(await getInvoice(received.id), null);
      await db().query(
        "UPDATE billing_settings SET payee_name='CHANGED recipient'",
      );
      assert.equal(
        (await getInvoice(token)).payee_name,
        'TEST recipient',
        'issued payment instructions never change after settings edits',
      );
      await assert.rejects(
        mutateJob({
          id: received.id,
          version: 1,
          action: 'publish',
          placement: 'premium',
        }),
        /ჩარიცხვა/,
      );
      await assert.rejects(
        mutateJob({ id: received.id, version: 1, action: 'publish' }),
        /ჩარიცხვა/,
        'omitting placement cannot bypass payment',
      );
      await mutateJob({
        id: received.id,
        version: 1,
        action: 'confirm-payment',
      });
      assert.equal(
        (await publicJobs(new URLSearchParams({ ids: received.id }))).total,
        0,
        'payment alone does not publish a vacancy',
      );
      await mutateJob({
        id: received.id,
        version: 2,
        action: 'publish',
        placement: 'premium',
      });
      inv = await getInvoice(token);
      assert.equal(inv.status, 'paid');
      assert.ok(inv.activated_at);
      const published = (
        await publicJobs(new URLSearchParams({ ids: received.id }))
      ).jobs[0];
      assert.equal(published.placement.tier, 'premium');
      const end = published.placement.expiresAt;
      await mutateJob({
        id: received.id,
        version: 3,
        action: 'publish',
        placement: 'premium',
      });
      assert.equal(
        (await publicJobs(new URLSearchParams({ ids: received.id }))).jobs[0]
          .placement.expiresAt,
        end,
      );
      const unpaid = await submitJob(
        { ...payload, requestId: randomUUID(), title: key + ' unpaid' },
        key,
      );
      ids.push(unpaid.id);
      await mutateJob({ id: unpaid.id, version: 1, action: 'reject' });
      assert.equal(
        (await getInvoice(unpaid.invoiceUrl!.split('/').pop()!)).status,
        'cancelled',
      );
      const paid = await submitJob(
        { ...payload, requestId: randomUUID(), title: key + ' refund' },
        key,
      );
      ids.push(paid.id);
      await mutateJob({ id: paid.id, version: 1, action: 'confirm-payment' });
      await mutateJob({ id: paid.id, version: 2, action: 'reject' });
      assert.equal(
        (await getInvoice(paid.invoiceUrl!.split('/').pop()!)).status,
        'refund_required',
      );
      await mutateJob({ id: paid.id, version: 3, action: 'confirm-refund' });
      assert.equal(
        (await getInvoice(paid.invoiceUrl!.split('/').pop()!)).status,
        'refunded',
      );
    } finally {
      await db().query(
        'DELETE FROM job_invoices WHERE job_id=ANY($1::uuid[])',
        [ids],
      );
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
      await db().query('DELETE FROM billing_settings');
      if (old)
        await db().query(
          'INSERT INTO billing_settings(id,payee_name,bank_name,iban) VALUES(true,$1,$2,$3)',
          [old.payee_name, old.bank_name, old.iban],
        );
      await db().end();
    }
  },
);
