import * as statusRules from '@/lib/company-job-status';
import type { CompanyJobForm } from '@/lib/company-job-form';
import type { JobRejection } from '@/lib/job-rejection';

export type CompanyJob = {
  id: string;
  version: number;
  status: string;
  needsReview: boolean;
  rejection?: JobRejection | null;
  title: string;
  imported: boolean;
  salary: string;
  form: CompanyJobForm;
  createdAt: string;
  publishedAt: string | null;
  publicPath: string | null;
  placement?: 'standard' | 'vip' | 'premium';
  placementExpiresAt?: string | null;
  canOrderPlacement?: boolean;
  invoice?: {
    status: string;
    token: string;
    placement_tier: 'vip' | 'premium';
  } | null;
};
export type CompanyProfile = {
  publicPath?: string | null;
  coverUrl: string;
  benefits: string[];
  whyUs: string;
  cvBoxEnabled: boolean;
  name: string;
  website: string;
  description: string;
  logoUrl: string;
  version: number;
};

export async function companyRequest(
  path: string,
  data?: unknown,
  method = 'POST',
) {
  const res = await fetch(
    '/api/company/' + path,
    data
      ? {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }
      : { cache: 'no-store' },
  );
  const body = await res.json();
  if (!res.ok) {
    if (res.status === 401 && !['session', 'password'].includes(path)) {
      try { sessionStorage.setItem('jobx.company.sessionExpired', '1'); } catch {}
      window.location.reload();
    }
    throw Error(body.error || 'მოქმედება ვერ შესრულდა');
  }
  return body;
}

export type { JobGroup } from '@/lib/company-job-status';
const todayTbilisi = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tbilisi', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export const isExpired = (job: CompanyJob, today = todayTbilisi()) => statusRules.isExpired(job, today);
export const isClosed = (job: CompanyJob, today = todayTbilisi()) => statusRules.isClosed(job, today);
export const inGroup = (job: CompanyJob, group: statusRules.JobGroup, today = todayTbilisi()) => statusRules.inGroup(job, group, today);
export const jobGroupOf = (job: CompanyJob, today = todayTbilisi()) => statusRules.jobGroupOf(job, today);
export const jobStatus = (job: CompanyJob, today = todayTbilisi()) => statusRules.jobStatus(job, today);

const day = 86_400_000;
/** Whole days from today (local) to a YYYY-MM-DD deadline; null when there is none. */
export function daysLeft(deadline: string, now = new Date()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(deadline);
  if (!m) return null;
  const end = new Date(+m[1], +m[2] - 1, +m[3]);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((end.getTime() - today.getTime()) / day);
}
export function deadlineText(left: number | null) {
  if (left === null) return 'ვადა მითითებული არ არის';
  if (left < 0) return 'ვადა გასულია';
  if (left === 0) return 'ბოლო დღე დღესაა';
  if (left === 1) return 'ვადა ხვალ იწურება';
  return `${left} დღე დარჩა`;
}
const months = [
  'იანვარი',
  'თებერვალი',
  'მარტი',
  'აპრილი',
  'მაისი',
  'ივნისი',
  'ივლისი',
  'აგვისტო',
  'სექტემბერი',
  'ოქტომბერი',
  'ნოემბერი',
  'დეკემბერი',
];
/** "13 ნოემბერი"; the year is added only when it differs from the current one. */
export function formatDate(value: string | null, now = new Date()) {
  if (!value) return '';
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? value + 'T00:00:00+04:00' : value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() + 4 * 60 * 60 * 1000);
  const current = new Date(now.getTime() + 4 * 60 * 60 * 1000);
  const text = `${local.getUTCDate()} ${months[local.getUTCMonth()]}`;
  return local.getUTCFullYear() === current.getUTCFullYear() ? text : `${text}, ${local.getUTCFullYear()}`;
}
/** Georgian business times always use Asia/Tbilisi, regardless of the browser locale. */
export function formatTime(value: string | number) {
  const date = new Date(new Date(value).getTime() + 4 * 60 * 60 * 1000);
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
}

export function salaryText(job: CompanyJob) {
  if (job.imported) return job.salary;
  const { salaryFrom: from, salaryTo: to, salaryPeriod } = job.form;
  if (!from && !to) return '';
  const range =
    from && to ? `${from}–${to}` : from ? `${from}-დან` : `${to}-მდე`;
  return `${range} ₾ / ${salaryPeriod}`;
}
export function dateInDays(days: number, now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "დღეს", "გუშინ", "3 დღის წინ", then the date. */
export function timeAgo(value: string, now = new Date()) {
  const date = new Date(value);
  const days = Math.floor(
    (new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() -
      new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()) /
      86_400_000,
  );
  if (days <= 0) return 'დღეს';
  if (days === 1) return 'გუშინ';
  if (days < 7) return `${days} დღის წინ`;
  return formatDate(value, now);
}
export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}
