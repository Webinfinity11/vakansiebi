export type SourceId = 'hr' | 'samushao' | 'jobs' | 'ss' | 'hrgov';
export type ActiveSourceId = Exclude<SourceId, 'samushao'>;
export const sourceNames: Record<ActiveSourceId, string> = {
  hr: 'hr.ge',
  jobs: 'jobs.ge',
  ss: 'jobs.ss.ge',
  hrgov: 'vacancy.hr.gov.ge',
};
export type Vacancy = {
  logoUrl?: string;
  employmentType?: string;
  facts?: { label: string; value: string }[];
  applicationLinks?: { label: string; url: string }[];
  warnings?: string[];
  title: string;
  company: string;
  city: string;
  category: string;
  salary: string;
  salaryMin: number | null;
  currency: string;
  salaryPeriod: string;
  mode: string;
  description: string;
  url: string;
  source: string;
  deadline: string;
  datePosted: string;
};
export type PublicJob = Vacancy & {
  sourceChanged?: boolean;
  companyProfile?: { website: string; description: string };
  id: string;
  createdAt: string;
  sources: {
    source: string;
    url: string;
    checkedAt?: string | null;
    health?: 'recent' | 'stale' | 'unavailable' | 'unknown';
  }[];
};
export type AdminJob = {
  id: string;
  draft: Vacancy;
  published: Vacancy | null;
  status: string;
  needs_review: boolean;
  version: number;
  created_at: string;
  updated_at: string;
  items: {
    id: string;
    source_id: SourceId;
    url: string;
    raw: Vacancy;
    last_checked_at: string;
    error: string | null;
  }[];
  duplicates: { id: string; title: string; company: string }[];
};
export type Source = {
  id: SourceId;
  name: string;
  enabled: boolean;
  auto_enabled: boolean;
  interval_minutes: number;
  detail_interval_hours: number;
  last_started_at: string | null;
  last_success_at: string | null;
  next_run_at: string;
  last_error: string | null;
  consecutive_failures: number;
  requested_at: string | null;
  imported: number;
  queued: number;
};
export const categories = [
  'ტექნოლოგიები',
  'გაყიდვები',
  'მარკეტინგი',
  'ადმინისტრაცია',
  'ფინანსები',
  'ლოჯისტიკა',
  'მომსახურება',
  'სამედიცინო',
  'განათლება',
  'სხვა',
];
export type SourceRun = {
  id: string;
  source_id: SourceId;
  status: string;
  started_at: string;
  finished_at: string | null;
  discovered: number;
  imported: number;
  changed: number;
  failed: number;
  error: string | null;
};
