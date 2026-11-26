import { canOrderCompanyPlacement } from './company-billing';
import { currentInvoiceOrder } from './billing';
import { invoiceDetails, type CompanyInvoiceDetails, type JobInvoice } from '../billing';
import { syncCompanyJobs } from './company-accounts';
import { autoPublishIfTrusted } from './trusted-companies';
import type { JobRejection } from '../job-rejection';
import { removeSubmittedDraft } from './company-job-drafts';
import { jobQuestionsSchema } from '../job-questions';
import { z } from 'zod';
import type { PlacementTier } from '../placement';
import { db } from './db';
import { ApiError } from './auth';
import type { CompanyIdentity } from '../company-portal';
import type { Vacancy } from '../types';
import { companyJobForm, suggestJobCategory } from '../company-job-form';
import {
  submissionSchema,
  submissionDate,
  submissionVacancy,
  nativeSource,
} from '../job-submission';
import { submitJob } from './job-submissions';
import { mutateJob } from './jobs';
import { vacancyPath } from '../vacancy-navigation';

type OwnedJob = {
  id: string;
  version: number;
  status: string;
  needs_review: boolean;
  draft: Vacancy;
  published: Vacancy | null;
};
type ListedJob = OwnedJob & {
  created_at: Date;
  published_at: Date | null;
  placement_tier: PlacementTier;
  placement_expires_at: Date | null;
  requested_placement: PlacementTier | null;
  invoice: {
    status: string;
    token: string;
    placement_tier: 'vip' | 'premium';
    number: string;
    amount_gel: number;
    service_days: number;
    payee_name: string;
    bank_name: string;
    iban: string;
    created_at: string;
    activated_at: string | null;
    renewal_for_expires_at: string | null;
  } | null;
  questions: unknown;
  rejection: JobRejection | null;
};
export async function companyJobs(company: CompanyIdentity) {
  if (company.approvalStatus === 'approved') await syncCompanyJobs(company.companyKey).catch(() => 0);
  const { rows } = await db().query<ListedJob>(
    `SELECT j.id,j.version,j.status,j.needs_review,j.draft,j.published,j.created_at,j.published_at,j.placement_tier,j.placement_expires_at,s.requested_placement,(SELECT jsonb_build_object('status',i.status,'token',i.token,'placement_tier',i.placement_tier,'number',lpad(i.number::text,6,'0'),'amount_gel',i.amount_gel,'service_days',i.service_days,'payee_name',i.payee_name,'bank_name',i.bank_name,'iban',i.iban,'created_at',i.created_at,'activated_at',i.activated_at,'renewal_for_expires_at',i.renewal_for_expires_at) FROM job_invoices i WHERE i.job_id=j.id ${currentInvoiceOrder("i")}) AS invoice,q.questions,CASE WHEN j.status='rejected' AND r.job_id IS NOT NULL THEN jsonb_build_object('reason',r.reason,'note',r.note,'createdAt',r.created_at) ELSE NULL END AS rejection FROM jobs j JOIN company_job_ownership o ON o.job_id=j.id LEFT JOIN job_submissions s ON s.job_id=j.id LEFT JOIN company_job_questions q ON q.job_id=j.id LEFT JOIN job_rejections r ON r.job_id=j.id WHERE o.company_key=$1 ORDER BY j.created_at DESC LIMIT 300`,
    [company.companyKey],
  );
  return rows.map((job) => ({
    id: job.id,
    version: job.version,
    status: job.status,
    needsReview: job.needs_review,
    rejection: job.status === 'rejected' ? job.rejection : null,
    title: job.draft.title,
    form: {
      ...companyJobForm(job.draft),
      placement:
        job.invoice && !['pending', 'paid'].includes(job.invoice.status)
          ? 'standard'
          : (job.requested_placement ?? 'standard'),
      questions: jobQuestionsSchema.parse(job.questions ?? []),
    },
    placement: job.placement_tier,
    placementExpiresAt: job.placement_expires_at?.toISOString() ?? null,
    invoice: job.invoice,
    canOrderPlacement:
      canOrderCompanyPlacement(company, job, job.invoice),
    imported: job.draft.source !== nativeSource,
    salary: job.draft.salary,
    createdAt: job.created_at.toISOString(),
    publishedAt: job.published_at?.toISOString() ?? null,
    publicPath:
      job.status === 'published' && job.published
        ? vacancyPath({ id: job.id, title: job.published.title })
        : null,
  }));
}
export async function changeCompanyJob(
  company: CompanyIdentity,
  input: unknown,
) {
  const data = z
    .object({
      action: z.enum(['create', 'save', 'archive', 'restore']),
      id: z.uuid().optional(),
      requestId: z.uuid().optional(),
      draftId: z.uuid().optional(),
      version: z.number().int().positive().optional(),
      form: z.record(z.string(), z.unknown()).optional(),
    })
    .parse(input);
  const owner = {
    accountId: company.id,
    companyKey: company.companyKey,
    ...(data.action === 'create' && data.form && Object.hasOwn(data.form, 'questions')
      ? {
          questions: z
            .object({ questions: jobQuestionsSchema })
            .parse(data.form).questions,
        }
      : {}),
  };
  const placement = z
    .enum(['standard', 'vip', 'premium'])
    .parse(data.action === 'create' ? (data.form?.placement ?? 'standard') : 'standard');
  if (
    data.action === 'create' &&
    placement !== 'standard' &&
    company.role !== 'owner'
  )
    throw new ApiError(
      'ფასიანი განთავსების შეკვეთა მხოლოდ ანგარიშის მფლობელს შეუძლია.',
      403,
    );
  if (
    data.action === 'create' &&
    placement !== 'standard' &&
    (company.approvalStatus !== 'approved' || !company.emailVerified)
  )
    throw new ApiError(
      'ფასიანი განთავსებისთვის საჭიროა კომპანიისა და ელფოსტის დადასტურება.',
      403,
    );
  if (data.action === 'create') {
    const today = submissionDate();
    const deadline = typeof data.form?.deadline === 'string' ? data.form.deadline : '';
    const form = submissionSchema.parse({
      ...data.form,
      category: data.form?.category || suggestJobCategory(typeof data.form?.title === 'string' ? data.form.title : ''),
      deadline: !deadline || deadline < today ? submissionDate(new Date(Date.now() + 30 * 86400000)) : deadline,
      contact: data.form?.contact || company.email,
      requestId: data.requestId,
      company: company.name,
      notificationEmail: company.email,
      logo: '',
      placement,
      consent: true,
      fax: '',
    });
    const result = await submitJob(form, 'company:' + company.id, owner).catch(placementError);
    if (data.draftId) await removeSubmittedDraft(company, data.draftId);
    const autoPublished = placement === 'standard' && !result.alreadyReceived
      ? await autoPublishIfTrusted(company, result.id) : false;
    const row = (await db().query<JobInvoice>(
      `SELECT * FROM (SELECT * FROM job_invoices WHERE job_id=$1 ${currentInvoiceOrder()}) i WHERE status IN ('pending','paid')`,
      [result.id],
    )).rows[0];
    return { ...result, autoPublished, ...(row ? { invoice: invoiceDetails(row, `/invoices/${row.token}`) } : {}) };
  }
  if (!data.id || !data.version)
    throw new ApiError('მიუთითეთ ვაკანსია და მისი ვერსია.');
  const job = (
    await db().query<OwnedJob>(
      'SELECT j.id,j.version,j.status,j.needs_review,j.draft,j.published FROM jobs j JOIN company_job_ownership o ON o.job_id=j.id WHERE j.id=$1 AND o.company_key=$2',
      [data.id, company.companyKey],
    )
  ).rows[0];
  if (!job) throw new ApiError('ვაკანსია ვერ მოიძებნა.', 404);
  if (data.action === 'archive')
    return mutateJob(
      { id: data.id, version: data.version, action: 'archive' },
      owner,
    );
  const imported = job.draft.source !== nativeSource;
  const stored = companyJobForm(job.draft);
  const automaticDeadline = submissionDate(new Date(Date.now() + 30 * 86400000));
  const parsed = submissionSchema.parse({
    ...data.form,
    // Hidden fields are not editable on the one-page form. Validate visible
    // changes using safe defaults, then keep the stored representations below.
    category: stored.category || suggestJobCategory(typeof data.form?.title === 'string' ? data.form.title : job.draft.title),
    experience: '',
    languages: [],
    contact: company.email,
    deadline: automaticDeadline,
    salaryPeriod: stored.salaryPeriod,
    salaryBasis: stored.salaryBasis,
    employmentType: data.form?.employmentType ?? stored.employmentType,
    ...(imported
      ? { salaryFrom: '', salaryTo: '', experience: '', languages: [] }
      : {}),
    requestId: data.id,
    company: company.name,
    notificationEmail: company.email,
    logo: '',
    placement: 'standard',
    consent: true,
    fax: '',
  });
  const next = submissionVacancy(parsed, job.id, job.draft.logoUrl);
  const draft = {
    ...job.draft,
    ...next,
    source: job.draft.source,
    url: job.draft.url,
    datePosted: job.draft.datePosted,
    category: job.draft.category || next.category,
    deadline: data.action === 'restore' && (!job.draft.deadline || job.draft.deadline < submissionDate()) ? automaticDeadline : job.draft.deadline,
    facts: job.draft.facts,
    applicationLinks: job.draft.applicationLinks,
    salaryPeriod: job.draft.salaryPeriod || next.salaryPeriod,
    ...(imported
      ? {
          category: job.draft.category,
          mode: job.draft.mode,
          employmentType: job.draft.employmentType,
          salary: job.draft.salary,
          salaryMin: job.draft.salaryMin,
          currency: job.draft.currency,
          salaryPeriod: job.draft.salaryPeriod,
        }
      : {}),
    ...(job.draft.city !== next.city ? { coordinates: undefined } : {}),
  };
  let invoiceUrl: string | undefined;
  let invoice: CompanyInvoiceDetails | undefined;
  const result = await mutateJob(
    { id: data.id, version: data.version, action: data.action, draft },
    owner,
    async (c) => {
      if (data.draftId) await removeSubmittedDraft(company, data.draftId, c);
      // Editing cannot order or alter placement; the dedicated promotion screen does that.
      if (!invoice) {
        const row = (await c.query<JobInvoice>(
          `SELECT * FROM (SELECT * FROM job_invoices WHERE job_id=$1 ${currentInvoiceOrder()}) i WHERE status IN ('pending','paid')`,
          [data.id],
        )).rows[0];
        if (row) invoice = invoiceDetails(row, `/invoices/${row.token}`);
      }
    },
  ).catch(placementError);
  return { ...result, ...(invoiceUrl ? { invoiceUrl } : {}), ...(invoice ? { invoice } : {}) };
}

function placementError(error: unknown): never {
  if (error instanceof ApiError && error.status === 503) {
    throw new ApiError('ფასიანი განთავსება დროებით მიუწვდომელია. შეგიძლიათ აირჩიოთ უფასო სტანდარტული განთავსება.', 503);
  }
  throw error;
}
