import { randomBytes, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { db } from './db';
import { ApiError } from './auth';
import { queueInvoiceEmail } from './invoice-email';
import {
  billingSettingsSchema,
  premiumDays,
  premiumPriceGEL,
} from '../billing';

export async function billingSettings() {
  const row = (
    await db().query(
      'SELECT payee_name,bank_name,iban FROM billing_settings WHERE id=true',
    )
  ).rows[0];
  return billingSettingsSchema.safeParse(row).success ? row : null;
}
export async function createInvoice(
  c: PoolClient,
  job: { id: string; company: string; title: string; billingEmail: string },
) {
  const settings = (
    await c.query(
      'SELECT payee_name,bank_name,iban FROM billing_settings WHERE id=true',
    )
  ).rows[0];
  if (!billingSettingsSchema.safeParse(settings).success)
    throw new ApiError(
      'პრემიუმის გადახდის რეკვიზიტები ჯერ არ არის დამატებული. აირჩიე სტანდარტული ან VIP განთავსება.',
      503,
    );
  const token = randomBytes(32).toString('hex');
  const invoice = (
    await c.query(
      `INSERT INTO job_invoices(id,token,job_id,amount_gel,service_days,payer_name,vacancy_title,payee_name,bank_name,iban)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [
        randomUUID(),
        token,
        job.id,
        premiumPriceGEL,
        premiumDays,
        job.company,
        job.title,
        settings.payee_name,
        settings.bank_name,
        settings.iban,
      ],
    )
  ).rows[0];
  await queueInvoiceEmail(c, invoice, job.billingEmail);
  return `/invoices/${token}`;
}
export async function getInvoice(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  return (
    (await db().query('SELECT * FROM job_invoices WHERE token=$1', [token]))
      .rows[0] || null
  );
}
export async function confirmInvoice(
  c: PoolClient,
  jobId: string,
  action: 'confirm-payment' | 'confirm-refund',
) {
  const invoice = (
    await c.query('SELECT * FROM job_invoices WHERE job_id=$1 FOR UPDATE', [
      jobId,
    ])
  ).rows[0];
  if (!invoice) throw new ApiError('ინვოისი ვერ მოიძებნა');
  if (action === 'confirm-payment') {
    if (invoice.status !== 'pending')
      throw new ApiError('ინვოისი აღარ ელოდება გადახდას');
    await c.query(
      "UPDATE job_invoices SET status='paid',paid_at=now() WHERE id=$1",
      [invoice.id],
    );
  } else {
    if (invoice.status !== 'refund_required')
      throw new ApiError('ინვოისზე დაბრუნება არ არის მოთხოვნილი');
    await c.query(
      "UPDATE job_invoices SET status='refunded',refunded_at=now() WHERE id=$1",
      [invoice.id],
    );
  }
  await c.query(
    "INSERT INTO audit_log(job_id,action,actor,after_data) VALUES($1,$2,'admin',$3)",
    [jobId, action, { invoiceId: invoice.id, amount: invoice.amount_gel }],
  );
  await c.query(
    'UPDATE jobs SET version=version+1,updated_at=now(),needs_review=true WHERE id=$1',
    [jobId],
  );
}
/** A rejected order never leaves an unpaid invoice payable. A paid, unused order requires a manual refund. */
export async function cancelUnusedInvoice(c: PoolClient, jobId: string) {
  await c.query(
    "UPDATE job_invoices SET status=CASE WHEN status='paid' THEN 'refund_required' ELSE 'cancelled' END WHERE job_id=$1 AND activated_at IS NULL AND status IN ('pending','paid')",
    [jobId],
  );
}

/* What the billing tab opens on: the promotions running now, soonest to end first, and the
   money in each state. A month is counted in Tbilisi time, the way the invoices are dated. */
export async function billingOverview() {
  const [placements, totals] = await Promise.all([
    db().query(
      `SELECT j.id, coalesce(j.published->>'title', j.draft->>'title') title,
         coalesce(j.published->>'company', j.draft->>'company') company,
         j.placement_tier tier, j.placement_expires_at expires_at, i.status invoice_status
       FROM jobs j LEFT JOIN job_invoices i ON i.job_id=j.id
       WHERE j.placement_tier<>'standard' AND j.placement_expires_at>now()
       ORDER BY j.placement_expires_at, j.id LIMIT 200`,
    ),
    db().query(
      `SELECT
         coalesce(sum(amount_gel) FILTER (WHERE status='paid'
           AND date_trunc('month', paid_at AT TIME ZONE 'Asia/Tbilisi')=date_trunc('month', now() AT TIME ZONE 'Asia/Tbilisi')),0)::int this_month,
         coalesce(sum(amount_gel) FILTER (WHERE status='paid'
           AND date_trunc('month', paid_at AT TIME ZONE 'Asia/Tbilisi')=date_trunc('month', now() AT TIME ZONE 'Asia/Tbilisi')-interval '1 month'),0)::int last_month,
         coalesce(sum(amount_gel) FILTER (WHERE status='pending'),0)::int awaiting,
         count(*) FILTER (WHERE status='pending')::int awaiting_count,
         coalesce(sum(amount_gel) FILTER (WHERE status='refund_required'),0)::int refunds_due,
         count(*) FILTER (WHERE status='refund_required')::int refunds_due_count
       FROM job_invoices`,
    ),
  ]);
  return { placements: placements.rows, totals: totals.rows[0] };
}
