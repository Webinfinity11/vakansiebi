import { z } from 'zod';
import type { CompanyIdentity } from '../company-portal';
import { audit } from '../../worker/importer';
import { ApiError } from './auth';
import { db, transaction } from './db';
import { clearPublicJobsCache } from './jobs';
import { notificationDay } from './notification-jobs';

type DeadlineJob = { id: string; status: string; needs_review: boolean; draft: Record<string, unknown>; published: Record<string, unknown> | null };
export function extendedDeadline(job: DeadlineJob, now = new Date()) {
  if (job.status !== 'published' || !job.published) throw new ApiError('ვადის გაგრძელება მხოლოდ გამოქვეყნებულ ვაკანსიაზეა შესაძლებელი.', 409);
  if (job.needs_review) throw new ApiError('ვაკანსია შემოწმებას ელოდება. ცვლილებები რედაქტირების გვერდზე შეიტანეთ.', 409);
  const deadline = job.published.deadline;
  if (typeof deadline !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(deadline) || !Number.isFinite(Date.parse(deadline)) || new Date(deadline).toISOString().slice(0, 10) !== deadline)
    throw new ApiError('ვადის მისათითებლად გახსენით ვაკანსიის რედაქტირება.', 409);
  const today = Date.parse(notificationDay(now));
  const current = Date.parse(deadline);
  if (current > today + 7 * 86400000) throw new ApiError('ვადის გაგრძელება შესაძლებელი იქნება დასრულებამდე 7 დღით ადრე.', 409);
  return new Date(Math.min(Math.max(today, current) + 30 * 86400000, today + 90 * 86400000)).toISOString().slice(0, 10);
}
const jobSql = `SELECT j.id,j.status,j.needs_review,j.draft,j.published FROM jobs j
  JOIN company_job_ownership o ON o.job_id=j.id WHERE j.id=$1 AND o.company_key=$2`;
export async function companyJobDeadline(company: CompanyIdentity, jobId: string) {
  if (!z.uuid().safeParse(jobId).success) throw new ApiError('ვაკანსია ვერ მოიძებნა.', 404);
  const job = (await db().query<DeadlineJob>(jobSql, [jobId, company.companyKey])).rows[0];
  if (!job) throw new ApiError('ვაკანსია ვერ მოიძებნა.', 404);
  let reason = '';
  try { extendedDeadline(job); } catch (e) { if (e instanceof ApiError) reason = e.message; else throw e; }
  return { id: job.id, title: String(job.published?.title || job.draft.title || 'ვაკანსია'), deadline: String(job.published?.deadline || job.draft.deadline || ''), reason };
}
export async function extendJobDeadline(company: CompanyIdentity, jobId: string) {
  if (!['owner', 'recruiter'].includes(company.role)) throw new ApiError('ვადის გაგრძელების უფლება არ გაქვთ.', 403);
  if (!z.uuid().safeParse(jobId).success) throw new ApiError('ვაკანსია ვერ მოიძებნა.', 404);
  const result = await transaction(async c => {
    const job = (await c.query<DeadlineJob>(jobSql + ' FOR UPDATE OF j', [jobId, company.companyKey])).rows[0];
    if (!job) throw new ApiError('ვაკანსია ვერ მოიძებნა.', 404);
    const deadline = extendedDeadline(job);
    await c.query(`UPDATE jobs SET draft=jsonb_set(draft,'{deadline}',to_jsonb($2::text)),
      published=jsonb_set(published,'{deadline}',to_jsonb($2::text)),version=version+1,updated_at=now() WHERE id=$1`, [jobId, deadline]);
    await audit(c, jobId, 'deadline.extended', 'company:' + company.id, { deadline: job.published?.deadline }, { deadline });
    return { ok: true, deadline };
  });
  clearPublicJobsCache();
  return result;
}
