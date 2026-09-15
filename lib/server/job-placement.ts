import { premiumPriceGEL, premiumDays } from '../billing';
import type { PoolClient } from 'pg';
import { ApiError } from './auth';
import { companyKey } from '../company-key';
import { introductoryDays, type PlacementTier } from '../placement';

/** Called inside the moderation transaction, after the vacancy has passed publication checks. */
export async function approvePlacement(
  c: PoolClient,
  job: {
    id: string;
    placement_tier: PlacementTier;
    placement_expires_at: Date | null;
  },
  company: string,
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
  if (requested === 'premium') {
    const invoice = (
      await c.query('SELECT * FROM job_invoices WHERE job_id=$1 FOR UPDATE', [
        job.id,
      ])
    ).rows[0];
    if (
      !invoice ||
      invoice.status !== 'paid' ||
      invoice.amount_gel !== premiumPriceGEL ||
      invoice.service_days !== premiumDays
    )
      throw new ApiError(
        'პრემიუმის გამოქვეყნებამდე დაადასტურე 20 ₾-ის ჩარიცხვა',
      );
    if (invoice.activated_at) {
      if (job.placement_tier === 'premium' && job.placement_expires_at) return;
      throw new ApiError('ამ ინვოისით განთავსება უკვე გააქტიურებული იყო');
    }
    await c.query('UPDATE job_invoices SET activated_at=now() WHERE id=$1', [
      invoice.id,
    ]);
    await c.query(
      "UPDATE jobs SET placement_tier='premium',placement_expires_at=now()+$2 * interval '1 day' WHERE id=$1",
      [job.id, invoice.service_days],
    );
    await c.query(
      "INSERT INTO audit_log(job_id,action,actor,after_data) VALUES($1,'placement.approved','admin',$2)",
      [
        job.id,
        {
          tier: 'premium',
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
  // Saving or re-publishing an existing promotion never renews its clock.
  if (submission.bonus_company_key) {
    if (job.placement_tier === requested && job.placement_expires_at) return;
    throw new ApiError(
      'ამ განცხადების საჩუქარი უკვე გამოყენებულია. ხელახლა გააქტიურება არ ხდება.',
    );
  }
  const key = companyKey(company).replace(/^(?:შპს|სს|llc|ltd)(?=.{3})/u, '');
  if (key.length < 2) throw new ApiError('მიუთითე კომპანიის სრული სახელი');
  await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
    `placement-company:${key}`,
  ]);
  if (
    (
      await c.query(
        'SELECT 1 FROM job_submissions WHERE bonus_company_key=$1',
        [key],
      )
    ).rowCount
  )
    throw new ApiError(
      'ამ კომპანიას 14-დღიანი საჩუქარი უკვე გამოყენებული აქვს. აირჩიე სტანდარტული განთავსება.',
    );
  await c.query(
    'UPDATE job_submissions SET bonus_company_key=$2 WHERE job_id=$1',
    [job.id, key],
  );
  await c.query(
    "UPDATE jobs SET placement_tier=$2,placement_expires_at=now()+$3 * interval '1 day' WHERE id=$1",
    [job.id, requested, introductoryDays],
  );
  await c.query(
    "INSERT INTO audit_log(job_id,action,actor,after_data) VALUES($1,'placement.approved','admin',$2)",
    [job.id, { tier: requested, days: introductoryDays, price: 0 }],
  );
}
