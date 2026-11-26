import type { CompanyJob } from '../company-api';

export const PLACEMENT_REVIEW_NOTE = 'ვაკანსიისა და ჩარიცხვის დადასტურების შემდეგ';

export function placementDeadlinePassed(job: Pick<CompanyJob, 'form'>, now: Date): boolean {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tbilisi', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
  return !!job.form.deadline && job.form.deadline < today;
}

/** approved includes both company approval and email verification. */
export function canPromoteJob(
  job: Pick<CompanyJob, 'imported' | 'canOrderPlacement' | 'status' | 'form'>,
  owner: boolean,
  approved: boolean,
  now: Date,
): boolean {
  return owner && approved && !job.imported && !!job.canOrderPlacement
    && (job.status === 'pending' || job.status === 'published')
    && !placementDeadlinePassed(job, now);
}
