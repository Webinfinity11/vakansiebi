import { premiumDays, premiumPriceGEL, vipDays, vipPriceGEL } from '../billing';
import type { PoolClient } from 'pg';
import { ApiError } from './auth';
import { type PlacementTier } from '../placement';

/** Called inside the moderation transaction, after the vacancy has passed publication checks. */
export async function approvePlacement(
  c: PoolClient,
  job: {
    id: string;
    placement_tier: PlacementTier;
    placement_expires_at: Date | null;
  },
  _company: string,
  requested: PlacementTier,
) {
  const submission = (
    await c.query(
      'SELECT bonus_company_key FROM job_submissions WHERE job_id=$1 FOR UPDATE',
      [job.id],
    )
  ).rows[0];
  if (!submission) {
    if (requested !== 'standard')
      throw new ApiError(
        'შეთავაზება მხოლოდ JOBX-ზე დამატებულ განცხადებებზე მოქმედებს',
      );
    return;
  }
  if (requested !== 'standard') {
    const invoice = (
      await c.query('SELECT * FROM job_invoices WHERE job_id=$1 FOR UPDATE', [
        job.id,
      ])
    ).rows[0];
    // Preserve a previously granted free VIP without renewing its expiry.
    if (
      !invoice &&
      requested === 'vip' &&
      submission.bonus_company_key &&
      job.placement_tier === 'vip' &&
      job.placement_expires_at
    )
      return;
    if (
      !invoice ||
      invoice.status !== 'paid' ||
      (invoice.placement_tier ?? 'premium') !== requested ||
      // Preserve the terms of previously issued premium invoices.
      (requested === 'vip'
        ? invoice.amount_gel !== vipPriceGEL || invoice.service_days !== vipDays
        : ![20, premiumPriceGEL].includes(invoice.amount_gel) ||
          ![14, premiumDays].includes(invoice.service_days))
    )
      throw new ApiError(
        'გამოქვეყნებამდე დაადასტურე არჩეული პაკეტის ინვოისით გათვალისწინებული თანხის ჩარიცხვა',
      );
    if (invoice.activated_at) {
      if (job.placement_tier === requested && job.placement_expires_at) return;
      throw new ApiError('ამ ინვოისით განთავსება უკვე გააქტიურებული იყო');
    }
    await c.query('UPDATE job_invoices SET activated_at=now() WHERE id=$1', [
      invoice.id,
    ]);
    await c.query(
      "UPDATE jobs SET placement_tier=$3,placement_expires_at=now()+$2 * interval '1 day' WHERE id=$1",
      [job.id, invoice.service_days, requested],
    );
    await c.query(
      "INSERT INTO audit_log(job_id,action,actor,after_data) VALUES($1,'placement.approved','admin',$2)",
      [
        job.id,
        {
          tier: requested,
          days: invoice.service_days,
          price: invoice.amount_gel,
          invoiceId: invoice.id,
        },
      ],
    );
    return;
  }
  if (requested === 'standard') {
    await c.query(
      "UPDATE jobs SET placement_tier='standard',placement_expires_at=NULL WHERE id=$1",
      [job.id],
    );
    return;
  }
}
