import { notFound, redirect } from 'next/navigation';
import { z } from 'zod';
import { currentCompany } from '@/lib/server/company-auth';
import { getCompany } from '@/lib/server/companies';
import { companyJobs } from '@/lib/server/company-jobs';
import { get, getForJob, getLatestNew } from '@/lib/server/company-job-drafts';
import { newCompanyJob, newCompanyJobDefaults, type CompanyJobForm } from '@/lib/company-job-form';
import { restoreJobStep } from '@/lib/company-job-steps';
import { ApiError } from '@/lib/server/auth';

export async function loadWizard(options: { edit?: string; copy?: string; draft?: string }) {
  if (process.env.COMPANY_PORTAL_ENABLED !== 'true') redirect('/company');
  const identity = await currentCompany();
  if (!identity || identity.mustChangePassword || identity.role === 'viewer') redirect('/company');
  const id = options.edit ?? options.copy;
  if (id && !z.uuid().safeParse(id).success) notFound();
  const jobs = await companyJobs(identity);
  const job = id ? jobs.find(j => j.id === id) : undefined;
  if (id && !job) notFound();
  let draft = null;
  if (options.draft) {
    if (!z.uuid().safeParse(options.draft).success) notFound();
    try { draft = await get(identity, options.draft); }
    catch (error) { if (error instanceof ApiError && error.status === 404) redirect('/company/jobs/new'); throw error; }
    if (draft.jobId) redirect(`/company/jobs/${draft.jobId}/edit`);
  } else if (options.edit) draft = await getForJob(identity, options.edit);
  else if (!options.copy) draft = await getLatestNew(identity);
  const profile = await getCompany(identity.name);
  const base = job ? { ...newCompanyJob(), ...job.form, ...(!options.edit ? { placement: 'standard' as const, deadline: '' } : {}) } : newCompanyJobDefaults({ accountEmail: identity.email, lastJob: jobs[0]?.form });
  // Drafts intentionally accept incomplete fields; merge with the complete form defaults.
  const form = { ...base, ...draft?.form, placement: options.edit ? base.placement : 'standard' } as CompanyJobForm;
  return {
    identity: { role: identity.role, name: identity.name, companyKey: identity.companyKey, accountId: identity.id },
    profile: { name: profile.name, logoUrl: profile.logoUrl, description: profile.description, benefits: profile.benefits, whyUs: profile.whyUs },
    job: options.edit ? job : undefined, initialForm: form, baseForm: base,
    initialDraft: draft ? { id: draft.id, step: restoreJobStep(draft.step, draft.form.wizardVersion), updatedAt: draft.updatedAt, updatedBy: draft.updatedBy } : null,
    copy: !!options.copy, copySource: options.copy, resumeLatest: !options.edit && !options.copy && !options.draft,
  };
}
