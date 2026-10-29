import { z } from 'zod';
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

type OwnedJob = {
  id: string;
  version: number;
  status: string;
  needs_review: boolean;
  draft: Vacancy;
  published: Vacancy | null;
};
export async function companyJobs(company: CompanyIdentity) {
  const { rows } = await db().query<OwnedJob>(
    'SELECT j.id,j.version,j.status,j.needs_review,j.draft,j.published FROM jobs j JOIN company_job_ownership o ON o.job_id=j.id WHERE o.company_key=$1 ORDER BY j.created_at DESC LIMIT 300',
    [company.companyKey],
  );
  return rows.map((job) => ({
    id: job.id,
    version: job.version,
    status: job.status,
    needsReview: job.needs_review,
    title: job.draft.title,
    form: companyJobForm(job.draft),
    imported: job.draft.source !== nativeSource,
    salary: job.draft.salary,
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
      version: z.number().int().positive().optional(),
      form: z.record(z.string(), z.unknown()).optional(),
    })
    .parse(input);
  const owner = { accountId: company.id, companyKey: company.companyKey };
  if (data.action === 'create') {
    const form = submissionSchema.parse({
      ...data.form,
      requestId: data.requestId,
      company: company.name,
      notificationEmail: company.email,
      logo: '',
      placement: 'standard',
      consent: true,
      fax: '',
    });
    return submitJob(form, 'company:' + company.id, owner);
  }
  if (!data.id || !data.version)
    throw new ApiError('მიუთითე ვაკანსია და მისი ვერსია.');
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
    ...(imported ? { salaryFrom: '', salaryTo: '' } : {}),
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
  return mutateJob(
    { id: data.id, version: data.version, action: data.action, draft },
    owner,
  );
}
