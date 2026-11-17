import { syncCompanyJobs } from './company-accounts';
import { autoPublishIfTrusted } from './trusted-companies';
import type { JobRejection } from '../job-rejection';
import { removeSubmittedDraft } from './company-job-drafts';
import { jobQuestionsSchema } from '../job-questions';
import { z } from 'zod';
import { requestCompanyPlacement } from './company-billing';
import type { PlacementTier } from '../placement';
import { db } from './db';
import { ApiError } from './auth';
import type { CompanyIdentity } from '../company-portal';
import type { Vacancy } from '../types';
import { companyJobForm } from '../company-job-form';
import {
  submissionSchema,
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
  } | null;
  questions: unknown;
  rejection: JobRejection | null;
};
export async function companyJobs(company: CompanyIdentity) {
  if (company.approvalStatus === 'approved') await syncCompanyJobs(company.companyKey).catch(() => 0);
  const { rows } = await db().query<ListedJob>(
    `SELECT j.id,j.version,j.status,j.needs_review,j.draft,j.published,j.created_at,j.published_at,j.placement_tier,j.placement_expires_at,s.requested_placement,(SELECT jsonb_build_object('status',i.status,'token',i.token,'placement_tier',i.placement_tier) FROM job_invoices i WHERE i.job_id=j.id) AS invoice,q.questions,CASE WHEN j.status='rejected' AND r.job_id IS NOT NULL THEN jsonb_build_object('reason',r.reason,'note',r.note,'createdAt',r.created_at) ELSE NULL END AS rejection FROM jobs j JOIN company_job_ownership o ON o.job_id=j.id LEFT JOIN job_submissions s ON s.job_id=j.id LEFT JOIN company_job_questions q ON q.job_id=j.id LEFT JOIN job_rejections r ON r.job_id=j.id WHERE o.company_key=$1 ORDER BY j.created_at DESC LIMIT 300`,
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
      !!job.requested_placement && !job.invoice && !job.placement_expires_at,
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
    ...(data.form && Object.hasOwn(data.form, 'questions')
      ? {
          questions: z
            .object({ questions: jobQuestionsSchema })
            .parse(data.form).questions,
        }
      : {}),
  };
  const placement = z
    .enum(['standard', 'vip', 'premium'])
    .parse(data.form?.placement ?? 'standard');
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
    const form = submissionSchema.parse({
      ...data.form,
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
    return { ...result, autoPublished };
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
  const parsed = submissionSchema.parse({
    ...data.form,
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
    facts: [
      ...(job.draft.facts ?? []).filter(
        (fact) =>
          !/ელფოსტა|ტელეფონი/.test(fact.label) &&
          (imported || !['გამოცდილება', 'ენები'].includes(fact.label)) &&
          !(next.facts ?? []).some((item) => item.label === fact.label),
      ),
      ...(next.facts ?? []),
    ],
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
  const result = await mutateJob(
    { id: data.id, version: data.version, action: data.action, draft },
    owner,
    async (c) => {
      if (data.draftId) await removeSubmittedDraft(company, data.draftId, c);
      invoiceUrl = await requestCompanyPlacement(
        c,
        company,
        data.id!,
        placement,
      );
    },
  ).catch(placementError);
  return { ...result, ...(invoiceUrl ? { invoiceUrl } : {}) };
}

function placementError(error: unknown): never {
  if (error instanceof ApiError && error.status === 503) {
    throw new ApiError('ფასიანი განთავსება დროებით მიუწვდომელია. შეგიძლიათ აირჩიოთ უფასო სტანდარტული განთავსება.', 503);
  }
  throw error;
}
