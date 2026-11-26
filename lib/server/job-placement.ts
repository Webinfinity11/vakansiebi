import { currentJobInvoice } from './billing';
import { placementDeadline } from '../placement-deadline';
import { premiumDays, premiumPriceGEL, vipDays, vipPriceGEL } from '../billing';
import type { PoolClient } from 'pg';
import { ApiError } from './auth';
import { type PlacementTier } from '../placement';

/** Called inside moderation; the caller persists the returned deadline and bumps the version. */
export async function approvePlacement(
  c: PoolClient,
  job: {
    id: string;
    placement_tier: PlacementTier;
    placement_expires_at: Date | null;
  },
  _company: string,
  requested: PlacementTier,
  requestedDeadline?: string,
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
    const invoice = await currentJobInvoice(c, job.id);
    // An unpaid renewal must not block edits/re-approval of the current placement.
    if (invoice?.renewal_for_expires_at && ['pending', 'cancelled'].includes(invoice.status)
      && job.placement_tier === requested && job.placement_expires_at) return;
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
    if (invoice.renewal_for_expires_at && job.placement_tier !== requested)
      throw new ApiError('განახლების ინვოისი მიმდინარე განთავსებას არ შეესაბამება');
    const current = (await c.query(
      'SELECT draft,published FROM jobs WHERE id=$1 FOR UPDATE', [job.id],
    )).rows[0];
    const activated = (await c.query(
      'UPDATE job_invoices SET activated_at=now() WHERE id=$1 RETURNING activated_at',
      [invoice.id],
    )).rows[0].activated_at as Date;
    // A renewal starts after the existing term, or at confirmation if it expired.
    // Re-approving the same invoice returns above and cannot extend it twice.
    const base = invoice.renewal_for_expires_at
      ? new Date(Math.max(job.placement_expires_at?.getTime() ?? 0, new Date(invoice.paid_at).getTime()))
      : activated;
    const expiresAt = new Date(base.getTime() + invoice.service_days * 86400000);
    // Keep a later date from either snapshot (or the moderator's current edit).
    const deadline = [current.draft?.deadline, current.published?.deadline, requestedDeadline]
      .reduce<string>((later, value) => {
        const next = placementDeadline(value, expiresAt, 0);
        return next > later ? next : later;
      }, placementDeadline(undefined, expiresAt, 0));
    await c.query(
      `UPDATE jobs SET placement_tier=$3,placement_expires_at=$2,
        draft=CASE WHEN draft IS NULL THEN NULL ELSE jsonb_set(draft,'{deadline}',to_jsonb($4::text)) END,
        published=CASE WHEN published IS NULL THEN NULL ELSE jsonb_set(published,'{deadline}',to_jsonb($4::text)) END
        WHERE id=$1`,
      [job.id, expiresAt, requested, deadline],
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
          deadline,
          previousDraftDeadline: current.draft?.deadline,
          previousPublishedDeadline: current.published?.deadline,
        },
      ],
    );
    return deadline;
  }
  if (requested === 'standard') {
    await c.query(
      "UPDATE jobs SET placement_tier='standard',placement_expires_at=NULL WHERE id=$1",
      [job.id],
    );
    return;
  }
}
