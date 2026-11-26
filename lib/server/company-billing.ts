import { nativeSource } from '../job-submission';
import type { PoolClient } from 'pg';
import { db, transaction } from './db';
import { ApiError } from './auth';
import { billingSettings, createInvoiceDetails, currentJobInvoice, currentInvoiceOrder } from './billing';
import type { CompanyIdentity } from '../company-portal';
import { invoiceDetails, type CompanyInvoiceDetails } from '../billing';
import type { PlacementTier } from '../placement';

/** Shared server rule for starting another paid term (existing orders remain idempotent). */
export function canOrderCompanyPlacement(
  company: CompanyIdentity,
  job: { status: string; requested_placement: string | null; placement_expires_at: Date | null; draft: { source: string; deadline?: string } },
  invoice: { status: string; activated_at: string | Date | null } | null,
  now = new Date(),
): boolean {
  return company.role === 'owner' && company.approvalStatus === 'approved' && company.emailVerified
    && ['pending', 'published'].includes(job.status) && !!job.requested_placement
    && job.draft.source === nativeSource
    && (!job.draft.deadline || job.draft.deadline >= now.toLocaleDateString('en-CA', { timeZone: 'Asia/Tbilisi' }))
    && (!job.placement_expires_at || job.placement_expires_at.getTime() < now.getTime())
    && (!invoice || invoice.status === 'cancelled' || (invoice.status === 'paid' && !!invoice.activated_at));
}

/** Issued invoices stay immutable; a cancelled order can be replaced with a new invoice. */
export async function requestCompanyPlacement(
  c: PoolClient,
  company: CompanyIdentity,
  id: string,
  placement: PlacementTier,
): Promise<{ invoice: CompanyInvoiceDetails; created: boolean } | undefined> {
  if (placement === 'standard') {
    // A rejected/cancelled order may be restored as a free vacancy without reusing payment.
    await c.query(
      `UPDATE job_submissions s SET requested_placement='standard'
       FROM (SELECT * FROM job_invoices WHERE job_id=$1 ${currentInvoiceOrder()}) i,company_job_ownership o
       WHERE s.job_id=$1 AND i.job_id=s.job_id AND o.job_id=s.job_id AND o.company_key=$2
         AND i.activated_at IS NULL AND i.status IN ('cancelled','refunded','refund_required')`,
      [id, company.companyKey],
    );
    return undefined;
  }
  const job = (
    await c.query(
      `SELECT j.*,s.requested_placement FROM jobs j
     JOIN company_job_ownership o ON o.job_id=j.id
     LEFT JOIN job_submissions s ON s.job_id=j.id
     WHERE j.id=$1 AND o.company_key=$2 FOR UPDATE OF j`,
      [id, company.companyKey],
    )
  ).rows[0];
  if (!job) throw new ApiError('ვაკანსია ვერ მოიძებნა.', 404);
  if (!['pending', 'published'].includes(job.status))
    throw new ApiError('დახურული ვაკანსია ჯერ ხელახლა გაგზავნეთ.', 409);
  if (!job.requested_placement)
    throw new ApiError(
      'ფასიანი განთავსება მხოლოდ JOBX-ზე დამატებულ ვაკანსიაზეა ხელმისაწვდომი.',
      409,
    );
  const invoice = await currentJobInvoice(c, id);
  if (invoice && invoice.status !== 'cancelled' && !canOrderCompanyPlacement(company, job, invoice)) {
    if (
      invoice.placement_tier === placement &&
      (invoice.status === 'pending' || (invoice.status === 'paid' && !invoice.activated_at))
    )
      return { invoice: invoiceDetails(invoice, `/invoices/${invoice.token}`), created: false };
    throw new ApiError(
      'ამ ვაკანსიაზე ინვოისი უკვე გაცემულია. განთავსების შესაცვლელად დაგვიკავშირდით.',
      409,
    );
  }
  if (company.role !== 'owner')
    throw new ApiError(
      'ფასიანი განთავსების შეკვეთა მხოლოდ ანგარიშის მფლობელს შეუძლია.',
      403,
    );
  if (company.approvalStatus !== 'approved' || !company.emailVerified)
    throw new ApiError(
      'ფასიანი განთავსებისთვის საჭიროა კომპანიისა და ელფოსტის დადასტურება.',
      403,
    );
  const account = (
    await c.query(
      `SELECT 1 FROM company_accounts a JOIN company_profiles p USING(company_key)
       WHERE a.id=$1 AND a.company_key=$2 AND a.enabled AND NOT a.must_change_password
       AND a.role='owner' AND a.email_verified AND p.approval_status='approved' FOR SHARE OF a,p`,
      [company.id, company.companyKey],
    )
  ).rowCount;
  if (!account)
    throw new ApiError('კომპანიის ანგარიშზე წვდომა შეზღუდულია.', 403);
  if (job.placement_expires_at && new Date(job.placement_expires_at).getTime() >= Date.now())
    throw new ApiError(
      'ამ ვაკანსიის ფასიანი განთავსება უკვე გაცემულია. განახლებისთვის დაგვიკავშირდით.',
      409,
    );
  if (
    job.draft.deadline &&
    job.draft.deadline <
      new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tbilisi' })
  )
    throw new ApiError('ვაკანსიის ბოლო ვადა გასულია. ჯერ ვადა განაახლეთ.', 409);
  if (!canOrderCompanyPlacement(company, job, invoice))
    throw new ApiError('ამ ვაკანსიის წინ წამოწევა მიუწვდომელია.', 409);
  const details = await createInvoiceDetails(c, {
    id,
    company: company.name,
    title: job.draft.title,
    billingEmail: company.email,
    placement,
  });
  await c.query(
    'UPDATE job_submissions SET requested_placement=$2 WHERE job_id=$1',
    [id, placement],
  );
  await c.query('UPDATE jobs SET needs_review=true WHERE id=$1', [id]);
  await c.query(
    "INSERT INTO audit_log(job_id,action,actor,after_data) VALUES($1,'company.placement_requested',$2,$3)",
    [id, 'company:' + company.id, { placement }],
  );
  return { invoice: details, created: true };
}

export async function upgradeCompanyJob(
  company: CompanyIdentity,
  id: string,
  version: number,
  placement: 'vip' | 'premium',
) {
  if (company.role !== 'owner')
    throw new ApiError('ფასიანი განთავსების შეკვეთა მხოლოდ ანგარიშის მფლობელს შეუძლია.', 403);
  return transaction(async (c) => {
    const job = (
      await c.query(
        `SELECT j.status,j.version FROM jobs j JOIN company_job_ownership o ON o.job_id=j.id
       WHERE j.id=$1 AND o.company_key=$2 FOR UPDATE OF j`,
        [id, company.companyKey],
      )
    ).rows[0];
    if (!job) throw new ApiError('ვაკანსია ვერ მოიძებნა.', 404);
    if (job.version !== version)
      throw new ApiError(
        'ჩანაწერი შეიცვალა. განაახლეთ სია და სცადეთ ხელახლა.',
        409,
      );
    if (!['pending', 'published'].includes(job.status))
      throw new ApiError(
        'დახურული ვაკანსია ჯერ ხელახლა გაგზავნეთ.',
        409,
      );
    const placementResult = await requestCompanyPlacement(c, company, id, placement);
    await c.query(
      'UPDATE jobs SET version=version+1,updated_at=now() WHERE id=$1',
      [id],
    );
    return { invoiceUrl: placementResult?.created ? placementResult.invoice.url : undefined, invoice: placementResult?.invoice };
  });
}

export async function companyBilling(company: CompanyIdentity) {
  const [invoices, settings] = await Promise.all([
    db().query(
      `SELECT i.* FROM job_invoices i JOIN company_job_ownership o ON o.job_id=i.job_id
       WHERE o.company_key=$1 ORDER BY i.created_at DESC`,
      [company.companyKey],
    ),
    billingSettings(),
  ]);
  return { invoices: invoices.rows, settings };
}
