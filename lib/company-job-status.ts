type StatusJob = { status: string; needsReview: boolean; form: { deadline: string } };

export type JobGroup = 'all' | 'active' | 'review' | 'closed';
const closedStatuses = ['archived', 'rejected', 'merged'];
export function isExpired(job: StatusJob, todayTbilisi: string) {
  return job.status === 'published' && !!job.form.deadline && job.form.deadline < todayTbilisi;
}
export function isClosed(job: StatusJob, todayTbilisi: string) {
  return closedStatuses.includes(job.status) || isExpired(job, todayTbilisi);
}
export function inGroup(job: StatusJob, group: JobGroup, todayTbilisi: string) {
  if (group === 'all') return true;
  if (group === 'active') return job.status === 'published' && !isExpired(job, todayTbilisi);
  if (group === 'review') return job.status === 'pending' || job.needsReview;
  return isClosed(job, todayTbilisi);
}

export function jobStatus(job: StatusJob, todayTbilisi: string): {
  label: string;
  tone: 'success' | 'warning' | 'danger' | 'neutral';
} {
  if (isExpired(job, todayTbilisi)) return { label: 'ვადა გასულია', tone: 'warning' };
  switch (job.status) {
    case 'published':
      return { label: 'აქტიური', tone: 'success' };
    case 'pending':
      return { label: 'განხილვაშია', tone: 'warning' };
    case 'rejected':
      return { label: 'უარყოფილი', tone: 'danger' };
    case 'merged':
      return { label: 'გაერთიანებული', tone: 'neutral' };
    case 'archived':
      return { label: 'დახურული', tone: 'neutral' };
    default:
      return { label: job.status, tone: 'neutral' };
  }
}

export function jobGroupOf(job: StatusJob, todayTbilisi: string): Exclude<JobGroup, 'all'> | null {
  if (isClosed(job, todayTbilisi)) return 'closed';
  if (inGroup(job, 'active', todayTbilisi)) return 'active';
  if (inGroup(job, 'review', todayTbilisi)) return 'review';
  return null;
}
