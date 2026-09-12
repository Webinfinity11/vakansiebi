export type SourceId =
  | 'hr'
  | 'samushao'
  | 'jobs'
  | 'ss'
  | 'hrgov'
  | 'gancxadebebi'
  | 'worknet'
  | 'myjobs';
export type ActiveSourceId = Exclude<SourceId, 'samushao'>;
export const sourceNames: Record<ActiveSourceId, string> = {
  hr: 'hr.ge',
  jobs: 'jobs.ge',
  ss: 'jobs.ss.ge',
  hrgov: 'vacancy.hr.gov.ge',
  gancxadebebi: 'gancxadebebi.ge',
  worknet: 'worknet.moh.gov.ge',
  myjobs: 'myjobs.ge',
};
/** Sources whose postings carry no employer entity, only a private contact. */
export const employerlessSources: readonly string[] = ['gancxadebebi.ge'];
export const privateListingLabel = 'კერძო განცხადება';
export type Vacancy = {
  fullTextUrl?: string;
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
  logoOrigin?: string;
  summary?: boolean;
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
  auto_publish?: boolean;
  refresh_pending?: number;
  refresh_retrying?: number;
  latest_run?: SourceRun | null;
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
  discovered?: number;
  published_count?: number;
  observed_pages?: number;
  reported_total?: number | null;
  reported_pages?: number | null;
  discovery_observed_at?: string | null;
  quality_warning?: string | null;
  quality_held?: number;
  due?: number;
  errored?: number;
  top_errors?: { message: string; count: number }[];
  /** Runs deferred because this network could not reach the source at all. */
  deferred_runs?: number;
  retired?: boolean;
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
  'მშენებლობა',
  'დაცვა',
  'წარმოება',
  'იურიდიული',
  'სილამაზე',
  'სხვა',
] as const;
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
