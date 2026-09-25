'use client';
import { BillingSettings } from './billing-settings';
import { invoiceNumber, invoiceStatuses } from '@/lib/billing';
import {
  placementLabels,
  placementTiers,
  type PlacementTier,
} from '@/lib/placement';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  Activity,
  Building2,
  ChartColumn,
  Check,
  ChevronDown,
  Clock3,
  ExternalLink,
  FileText,
  Flag,
  History,
  Inbox,
  Layers3,
  LayoutDashboard,
  ListChecks,
  LogOut,
  ReceiptText,
  RefreshCw,
  ScrollText,
  Search,
  X,
  type LucideIcon,
} from 'lucide-react';
import DateField from './date-field';
import { attentionItems, OverviewPanel } from './overview';
import { PostingInsights } from './posting-insights';
import { SkeletonRows } from '../skeleton';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Brand, Choice } from '../job-board';
import { CompanyLogo } from '../company-logo';
import { CompanyEditor } from './company-editor';
import type { AdminJob, Source, Vacancy, SourceRun } from '@/lib/types';
import { categories, listingSourceNames } from '@/lib/types';
import { sourceHealth } from '@/lib/scraper-status';
import { EmployersPanel } from './employers';
import { AnalyticsPanel } from './analytics';
import {
  useVacancyAnalytics,
  VacancyAnalyticsBlock,
  SubmissionPerformance,
} from './vacancy-analytics';
import { ReportsSection } from './reports';
import { ResumesPanel } from './resumes';
import { HistoryPanel, JobHistory } from './history';
import type { githubScraperStatus } from '@/lib/server/scraper-github';
import { runMessage } from '@/lib/run-messages';
import { adminTime } from '@/lib/admin-format';
import { ScraperMetricsPanel } from './scraper-metrics';
import { ScraperLimits } from './scraper-limits';
import { SelectField } from '../select-field';
import type { ScraperMetrics } from '@/lib/server/scraper-metrics';
type AdminSource = Source & { removed_count?: number };
const names: Record<string, string> = {
  pending: 'შემოტანილი',
  published: 'გამოქვეყნებული',
  archived: 'არქივი',
  rejected: 'უარყოფილი',
  merged: 'გაერთიანებული',
  running: 'მიმდინარეობს',
  success: 'წარმატებული',
  partial: 'ნაწილობრივი',
  failed: 'შეცდომა',
  deferred: 'ავტომატური გამეორების მოლოდინში',
  interrupted: 'შეწყდა',
};
const automationReasons: Record<string, string> = {
  employer_submission: 'დამსაქმებლის განცხადება — ელოდება განხილვას',
  expired: 'ბოლო ვადა გასულია',
  removed: 'წყაროზე აღარ არსებობს',
  unverified: 'დიდი ხანია ვერ მოწმდება',
  invalid_source_data: 'წყაროს მონაცემები არასრულია',
  awaiting_source: 'წყაროს პირველ შემოწმებას ელოდება',
};
/** `Choice` prepends its own "ყველა" option, which maps back to the unfiltered `all`. */
const statusFilters: Record<string, string> = {
  review: 'შესამოწმებელი',
  paused: 'ავტომატიზაცია შეჩერებული',
  manual: 'ხელით მართული',
  blocked: 'ავტომატურად ვერ ქვეყნდება',
  pending: 'შემოტანილი',
  published: 'გამოქვეყნებული',
  archived: 'არქივი',
  rejected: 'უარყოფილი',
};
const intervalOptions = [180, 360, 720, 1440].map((m) => ({
  value: String(m),
  label: `${m / 60} საათი`,
}));
const time = (v: string | null) => (v ? adminTime(v) : 'ჯერ არ შემოწმებულა');
async function request(url: string, body?: unknown) {
  const r = await fetch(
    url,
    body
      ? {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      : undefined,
  );
  const d = await r.json();
  if (r.status === 401) {
    window.location.assign('/admin');
    throw Error('სესია დასრულდა');
  }
  if (!r.ok) throw Error(d.error || 'ოპერაცია ვერ შესრულდა');
  return d;
}
/* An active promotion keeps its tier and a paid request stays premium; otherwise an employer's
   vacancy is offered the free VIP whenever the company has not used it yet. */
function defaultPlacement(j: AdminJob): PlacementTier {
  if (j.placement_expires_at) return j.placement_tier;
  if (j.requested_placement === 'premium') return 'premium';
  if (j.submitted_at) return j.vip_available ? 'vip' : 'standard';
  return j.requested_placement || 'standard';
}
/* JOBX's own vacancies, sent through the posting form, kept apart from the imported catalogue. */
const submissionViews = [
  ['submissions', 'დადასტურებას ელოდება'],
  ['submissions-published', 'გამოქვეყნებული'],
  ['submissions-closed', 'არქივი / უარყოფილი'],
  ['submissions-all', 'ყველა'],
  ['submissions-test', 'ტესტები'],
] as const;
type SubmissionView = (typeof submissionViews)[number][0];
/* Every section opens the same way: what it is and what the admin does there. */
function SectionHeading({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <header className="admin-page-head">
      <h1>{title}</h1>
      <p>{children}</p>
    </header>
  );
}
/* A submission is read first and edited only if needed, so its editor starts folded away. */
function EditorWrap({
  submission,
  children,
}: {
  submission: boolean;
  children: ReactNode;
}) {
  if (!submission) return <>{children}</>;
  return (
    <details className="raw-details submission-edit">
      <summary>
        <ChevronDown className="admin-summary-mark" aria-hidden="true" />
        რედაქტირება დადასტურებამდე
      </summary>
      {children}
    </details>
  );
}
/* What the employer sent through the posting form, laid out the way it will read on the site. */
function SubmissionSummary({ job, draft }: { job: AdminJob; draft: Vacancy }) {
  const rows: [string, string][] = [
    ['პოზიცია', draft.title],
    ['კომპანია', draft.company],
    ['მიმართულება', draft.category],
    ['ქალაქი', draft.city],
    ['სამუშაო რეჟიმი', draft.mode || ''],
    ['განაკვეთი', draft.employmentType || ''],
    ['ანაზღაურება', draft.salary],
    ['ბოლო ვადა', draft.deadline],
    [
      'მოთხოვნილი განთავსება',
      job.requested_placement ? placementLabels[job.requested_placement] : '',
    ],
    ['გაგზავნდა', time(job.submitted_at || job.created_at)],
  ];
  const contacts = [
    ...(draft.facts || []).map((f) => `${f.label}: ${f.value}`),
    ...(draft.applicationLinks || []).map((l) => `${l.label}: ${l.url}`),
  ];
  return (
    <section className="submission-summary">
      <div className="editor-logo-row">
        <CompanyLogo company={draft.company} url={draft.logoUrl} />
        <div>
          <strong>{draft.title}</strong>
          <p>{draft.logoUrl ? 'ატვირთული ლოგო' : 'ლოგო არ ატვირთა'}</p>
        </div>
      </div>
      <dl>
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value || '—'}</dd>
          </div>
        ))}
        <div className="full-width">
          <dt>დაკავშირების გზა</dt>
          <dd>
            {contacts.length
              ? contacts.map((c) => <span key={c}>{c}</span>)
              : 'მითითებული არ არის'}
          </dd>
        </div>
      </dl>
      <h3>აღწერა</h3>
      <p className="raw-text">{draft.description}</p>
    </section>
  );
}
export default function AdminPanel() {
  const [scraperMetrics, setScraperMetrics] = useState<ScraperMetrics | null>(
    null,
  );
  const [observedAt, setObservedAt] = useState(0);
  const [summary, setSummary] = useState<{
    imported: number;
    changed: number;
    failed: number;
    completed_runs: number;
  } | null>(null);
  const [github, setGithub] = useState<Awaited<
    ReturnType<typeof githubScraperStatus>
  > | null>(null);
  // The panel opens on the state of things, not on a queue.
  const [menuOpen, setMenuOpen] = useState(false);
  const [tab, setTab] = useState('control'),
    [submissionView, setSubmissionView] =
      useState<SubmissionView>('submissions'),
    [status, setStatus] = useState('review'),
    [sourceFilter, setSourceFilter] = useState(''),
    [query, setQuery] = useState(''),
    [page, setPage] = useState(1),
    [jobs, setJobs] = useState<AdminJob[]>([]),
    [total, setTotal] = useState(0),
    [counts, setCounts] = useState({
      pending: 0,
      published: 0,
      review: 0,
      archived: 0,
      paused: 0,
      manual: 0,
      blocked: 0,
      submissions: 0,
      'submissions-published': 0,
      'submissions-closed': 0,
      'submissions-all': 0,
      reports: 0,
    } as Record<string, number>),
    [sources, setSources] = useState<AdminSource[]>([]),
    [runs, setRuns] = useState<SourceRun[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [billingVersion, setBillingVersion] = useState(0),
    [selected, setSelected] = useState<AdminJob | null>(null),
    [placement, setPlacement] = useState<PlacementTier>('standard'),
    [draft, setDraft] = useState<Vacancy | null>(null),
    [confirm, setConfirm] = useState<{
      action: string;
      itemId?: string;
      targetId?: string;
    } | null>(null);
  /* A confirmation reads once and leaves; an error stays until the next action. */
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 6000);
    return () => clearTimeout(timer);
  }, [message]);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, b] = await Promise.all([
        tab === 'vacancies'
          ? request(
              `/api/admin/jobs?status=${status}&q=${encodeURIComponent(query)}&page=${page}&source=${sourceFilter}`,
            )
          : tab === 'submissions'
            ? request(`/api/admin/jobs?status=${submissionView}&page=${page}`)
            : Promise.resolve(null),
        request('/api/admin/sources'),
      ]);
      if (a) {
        setJobs(a.jobs);
        setTotal(a.total);
      }
      setCounts(b.summary.counts);
      setSummary(b.summary);
      setScraperMetrics(b.metrics ?? null);
      setSources(b.sources);
      setRuns(b.runs);
      setGithub(b.github);
      setObservedAt(Date.parse(b.observedAt));
      setError('');
      return a?.jobs as AdminJob[] | undefined;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [status, query, page, sourceFilter, tab, submissionView]);
  useEffect(() => {
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [load]);
  /* The list is not reloaded on a timer. A full editorial snapshot is the most
     expensive query this application runs and it is never cached, so a tab left
     open all day paid for a few hundred of them; worse, the list moved under
     whoever was reading it. Every action already reloads, and the refresh
     button is beside the search field. */
  const act = async (action: string, extras: Record<string, unknown> = {}) => {
    if (!selected) return;
    const selectedIndex = jobs.findIndex((job) => job.id === selected.id);
    const nextJob =
      ['publish', 'reject', 'archive'].includes(action) &&
      ['vacancies', 'submissions'].includes(tab) &&
      selectedIndex >= 0
        ? jobs[selectedIndex + 1]
        : undefined;
    setBusy(true);
    setError('');
    try {
      await request('/api/admin/jobs', {
        id: selected.id,
        version: selected.version,
        action,
        ...(['save', 'publish'].includes(action) ? { draft } : {}),
        ...(action === 'publish' && selected.requested_placement
          ? { placement }
          : {}),
        ...extras,
      });
      if (!nextJob) setSelected(null);
      setBillingVersion((v) => v + 1);
      setConfirm(null);
      setMessage(
        action === 'publish'
          ? 'ვაკანსია გამოქვეყნდა. შეტყობინება არ გაგზავნილა.'
          : action === 'reject'
            ? 'განცხადება უარყოფილია. შეტყობინება არ გაგზავნილა.'
            : 'ცვლილება შენახულია.',
      );
      const refreshedJobs = await load();
      if (nextJob) {
        const next = refreshedJobs?.find((job) => job.id === nextJob.id);
        if (next) openJob(next);
        else setSelected(null);
      }
    } catch (e) {
      setError((e as Error).message);
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  };
  const publishAll = async () => {
    setBusy(true);
    setError('');
    let published = 0;
    let skipped = 0;
    try {
      const { items } = await request('/api/admin/jobs/bulk');
      for (let start = 0; start < items.length; start += 20) {
        const { results } = await request(
          '/api/admin/jobs/bulk',
          items.slice(start, start + 20),
        );
        published += results.filter(
          (r: { published: boolean }) => r.published,
        ).length;
        skipped += results.filter(
          (r: { published: boolean }) => !r.published,
        ).length;
        setMessage(`გამოქვეყნდა ${published} / ${items.length}. მიმდინარეობს…`);
      }
      setMessage(
        `გამოქვეყნდა ${published} ვაკანსია. გამოტოვებულია ${skipped} — საჭიროებს შემოწმებას. შეტყობინებები არ გაგზავნილა.`,
      );
    } catch (e) {
      setMessage(`გამოქვეყნდა ${published} ვაკანსია.`);
      setError(
        `${(e as Error).message}. შეგიძლია ხელახლა გაუშვა — უკვე გამოქვეყნებული ჩანაწერები აღარ დამუშავდება.`,
      );
    } finally {
      setBusy(false);
      setConfirm(null);
      await load();
    }
  };
  /* The count beside the overview: the same grouped findings its attention list shows. */
  const noop = () => {};
  const attention = attentionItems({
    sources,
    now: observedAt,
    waiting: counts.submissions ?? 0,
    reports: counts.reports ?? 0,
    go: noop,
    onAct: noop,
    onReview: noop,
  }).items.length;
  const sourceAction = async (
    s: { id: Source['id'] | 'all' },
    body: Record<string, unknown>,
  ) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const d = await request('/api/admin/sources', { id: s.id, ...body });
      setMessage(d.message || 'წყაროს პარამეტრები შენახულია.');
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const change = <K extends keyof Vacancy>(key: K, value: Vacancy[K]) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  const commonInterval =
    sources.length && new Set(sources.map((s) => s.interval_minutes)).size === 1
      ? sources[0].interval_minutes
      : null;
  const openJob = (j: AdminJob) => {
    setSelected(j);
    setDraft(j.draft);
    setPlacement(defaultPlacement(j));
    setError('');
  };
  /* Opens the editor over whichever tab is showing; a caller that wants the list behind it
     switches tabs in `onFound`. */
  const openJobById = async (id: string, onFound?: () => void) => {
    try {
      const data = await request(
        `/api/admin/jobs?status=all&id=${encodeURIComponent(id)}`,
      );
      const job = data.jobs[0] as AdminJob | undefined;
      if (!job) throw Error('ვაკანსია ვერ მოიძებნა');
      onFound?.();
      openJob(job);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ჩატვირთვა ვერ მოხერხდა');
    }
  };
  const submission = !!selected?.submitted_at;
  const [insightsRound, setInsightsRound] = useState(0);
  const markTest = async (test: boolean) => {
    if (!selected) return;
    setBusy(true);
    setError('');
    try {
      await request('/api/admin/submissions', { id: selected.id, test });
      setSelected({ ...selected, is_test: test });
      setInsightsRound((n) => n + 1); // the form's statistics leave test posts out
      setMessage(test ? 'მონიშნულია ტესტად' : 'დაბრუნდა ნამდვილ განცხადებებში');
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const vacancyStats = useVacancyAnalytics(
    tab === 'submissions' && !loading ? jobs.map((job) => job.id) : [],
    jobs,
  );
  /* Only JOBX's own vacancies carry statistics: an imported one's employer is not ours and
     never sees them. The open one also gets its daily series. */
  const selectedStats = useVacancyAnalytics(
    submission && selected ? [selected.id] : [],
    jobs,
    true,
  );
  const jobList = () => (
    <>
      {loading ? (
        <SkeletonRows rows={4} block label="ვაკანსიები იტვირთება" />
      ) : !jobs.length ? (
        <div className="empty">
          <Layers3 size={20} />
          {tab === 'submissions' ? (
            <>
              <h3>
                {submissionView === 'submissions'
                  ? 'ახალი განცხადება არ არის'
                  : 'ამ სიაში ვაკანსია არ არის'}
              </h3>
              <p>JOBX-ზე ფორმით გაგზავნილი ვაკანსია აქ გამოჩნდება.</p>
            </>
          ) : (
            <>
              <h3>ამ სიაში ვაკანსიები ჯერ არ არის</h3>
              <p>
                წყაროების ჩანართიდან გაუშვი შემოწმება ან აირჩიე სხვა სტატუსი.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="admin-job-list ds-appear-list">
          {jobs.map((j) => (
            <button className="admin-job" key={j.id} onClick={() => openJob(j)}>
              <CompanyLogo company={j.draft.company} url={j.draft.logoUrl} />
              <div className="admin-job-text">
                <span>
                  {j.draft.company} ·{' '}
                  {j.submitted_at
                    ? `გაგზავნდა ${time(j.submitted_at)}`
                    : j.draft.source}
                </span>
                <strong>{j.draft.title}</strong>
                <small>
                  {j.draft.city || 'ქალაქი დასაზუსტებელია'} ·{' '}
                  {j.draft.salary || 'ხელფასი მითითებული არ არის'}
                </small>
              </div>
              <div className="admin-job-status">
                {tab === 'submissions' && (
                  <small
                    title={
                      vacancyStats?.error ||
                      'ნახვები — სულ, შეგროვებული ისტორია'
                    }
                  >
                    ნახვები (სულ):{' '}
                    {vacancyStats?.data?.[j.id]?.total.view ?? '—'}
                  </small>
                )}
                {j.is_test && <span className="ds-badge">ტესტი</span>}
                {j.submitted_at && j.status === 'pending' ? (
                  <span className="status status-pending">
                    დადასტურებას ელოდება
                  </span>
                ) : (
                  <span className={`status status-${j.status}`}>
                    {names[j.status]}
                  </span>
                )}
                {j.requested_placement &&
                  j.requested_placement !== 'standard' && (
                    <span className="ds-badge ds-badge--violet">
                      {placementLabels[j.requested_placement]}
                    </span>
                  )}
                {!j.submitted_at &&
                  (j.automation_paused || !j.automation_managed) && (
                    <span className="ds-badge">ხელით მართული</span>
                  )}
                {!j.submitted_at &&
                  j.automation_reason &&
                  j.status !== 'published' && (
                    <span className="ds-badge ds-badge--warning">
                      {automationReasons[j.automation_reason] ||
                        j.automation_reason}
                    </span>
                  )}
                {j.needs_review &&
                  !['pending', 'rejected'].includes(j.status) && (
                    <span className="ds-badge ds-badge--warning">
                      ცვლილება შესამოწმებელია
                    </span>
                  )}
                {j.duplicates.length > 0 && (
                  <span className="ds-badge ds-badge--warning">
                    შესაძლო დუბლიკატი
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
      <div className="admin-pagination">
        <span className="admin-pagination-count">
          {loading ? '' : `${total} ჩანაწერი`}
        </span>
        <button
          type="button"
          className="ds-btn ds-btn--secondary ds-btn--sm"
          disabled={page === 1}
          onClick={() => setPage((p) => p - 1)}
        >
          წინა
        </button>
        <span>{page}</span>
        <button
          type="button"
          className="ds-btn ds-btn--secondary ds-btn--sm"
          disabled={page * 30 >= total}
          onClick={() => setPage((p) => p + 1)}
        >
          შემდეგი
        </button>
      </div>
    </>
  );
  const navGroups: {
    title: string;
    items: {
      id: string;
      label: string;
      icon: LucideIcon;
      count?: number;
      alert?: boolean;
    }[];
  }[] = [
    {
      title: 'სამუშაო',
      items: [
        {
          id: 'control',
          label: 'მიმოხილვა',
          icon: LayoutDashboard,
          count: attention,
          alert: true,
        },
        {
          id: 'submissions',
          label: 'ჩვენი ვაკანსიები',
          icon: Inbox,
          count: counts.submissions,
          alert: true,
        },
        {
          id: 'reports',
          label: 'შეტყობინებები',
          icon: Flag,
          count: counts.reports,
        },
      ],
    },
    {
      title: 'კატალოგი',
      items: [
        {
          id: 'vacancies',
          label: 'ვაკანსიები',
          icon: ListChecks,
          count: counts.review,
        },
        { id: 'employers', label: 'კომპანიები', icon: Building2 },
      ],
    },
    {
      title: 'წყაროები',
      items: [
        { id: 'sources', label: 'მონიტორინგი', icon: Activity },
        { id: 'runs', label: 'გაშვებები', icon: History },
      ],
    },
    {
      title: 'ფინანსები',
      items: [{ id: 'billing', label: 'ინვოისები', icon: ReceiptText }],
    },
    {
      title: 'მომხმარებლები',
      items: [
        { id: 'analytics', label: 'ანალიტიკა', icon: ChartColumn },
        { id: 'resumes', label: 'CV-ები', icon: FileText },
      ],
    },
    {
      title: 'სისტემა',
      items: [{ id: 'history', label: 'ისტორია', icon: ScrollText }],
    },
  ];
  const current = navGroups
    .flatMap((g) => g.items)
    .find((item) => item.id === tab);
  const go = (id: string) => {
    setPage(1);
    setTab(id);
    setMenuOpen(false);
  };
  return (
    <div className="admin-page admin-shell">
      <div className="admin-mobilebar">
        <Brand />
        <button
          type="button"
          className="admin-menu-button ds-btn ds-btn--secondary"
          aria-expanded={menuOpen}
          aria-controls="admin-nav"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span>{current?.label ?? 'მენიუ'}</span>
          {!!attention && <b>{attention}</b>}
          <ChevronDown size={16} aria-hidden="true" />
        </button>
      </div>
      {menuOpen && (
        <button
          type="button"
          className="admin-scrim"
          aria-label="მენიუს დახურვა"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside className="admin-side" id="admin-nav" data-open={menuOpen}>
        <div className="admin-side-brand">
          <Brand />
          <span>ადმინი</span>
        </div>
        <nav aria-label="ადმინის განყოფილებები">
          {navGroups.map((group) => (
            <div className="admin-nav-group" key={group.title}>
              <h2>{group.title}</h2>
              {group.items.map(({ id, label, icon: Icon, count, alert }) => (
                <button
                  key={id}
                  type="button"
                  aria-current={tab === id ? 'page' : undefined}
                  onClick={() => go(id)}
                >
                  <Icon size={16} aria-hidden="true" />
                  <span>{label}</span>
                  {!!count && (
                    <b className={alert ? 'admin-count-alert' : undefined}>
                      {count}
                    </b>
                  )}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="admin-side-foot">
          <Link href="/?preview=1" target="_blank">
            <ExternalLink size={16} aria-hidden="true" />
            საიტის ნახვა
          </Link>
          <button
            type="button"
            onClick={async () => {
              await fetch('/api/admin/session', { method: 'DELETE' });
              window.location.assign('/admin');
            }}
          >
            <LogOut size={16} aria-hidden="true" />
            გასვლა
          </button>
        </div>
      </aside>
      <main className="admin-main">
        {error && (
          <div role="alert" className="notice">
            {error}
          </div>
        )}
        {message && (
          <output className="admin-toast">
            <Check size={16} aria-hidden="true" />
            {message}
            <button
              type="button"
              onClick={() => setMessage('')}
              aria-label="შეტყობინების დახურვა"
            >
              <X size={16} />
            </button>
          </output>
        )}
        {tab === 'control' && (
          <section className="admin-panel">
            <SectionHeading title="მიმოხილვა">
              რა გაჩერდა და რა გასაკეთებელია — დეტალები დანარჩენ
              განყოფილებებშია.
            </SectionHeading>
            <OverviewPanel
              sources={sources}
              now={observedAt}
              busy={busy}
              counts={counts}
              go={go}
              onReview={(source) => {
                setStatus('review');
                setSourceFilter(source);
                setQuery('');
                setPage(1);
                setTab('vacancies');
              }}
              onAct={(source, body) =>
                void sourceAction({ id: source as Source['id'] | 'all' }, body)
              }
              onOpenJob={(id) => void openJobById(id)}
            />
          </section>
        )}
        {tab === 'submissions' && (
          <section className="admin-panel">
            <SectionHeading title="ჩვენი ვაკანსიები">
              JOBX-ზე ფორმით გაგზავნილი; საიტზე მხოლოდ შენი დადასტურებით ჩნდება.
            </SectionHeading>
            <fieldset
              className="admin-chips admin-chips--scroll"
              aria-label="ჩვენი ვაკანსიების სტატუსი"
            >
              {submissionViews.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className="ds-chip"
                  aria-pressed={submissionView === key}
                  onClick={() => {
                    setPage(1);
                    setSubmissionView(key);
                  }}
                >
                  {label} <b>{counts[key] ?? 0}</b>
                </button>
              ))}
            </fieldset>
            {jobList()}
            {/* Measured only once there is something to measure: after the queue, not before it. */}
            <SubmissionPerformance onOpen={(id) => void openJobById(id)} />
            <PostingInsights key={insightsRound} />
          </section>
        )}
        {tab === 'vacancies' && (
          <section className="admin-panel">
            <SectionHeading title="ვაკანსიები">
              შემოტანილი ვაკანსიები: რაც შემოწმებას ან ხელით მართვას სჭირდება.
            </SectionHeading>
            <div className="admin-stats">
              {(
                [
                  ['გამოქვეყნებული', counts.published, 'published'],
                  ['შესამოწმებელი', counts.review, 'review'],
                  ['ხელით მართული', counts.manual, 'manual'],
                  ['ავტომატურად ვერ ქვეყნდება', counts.blocked, 'blocked'],
                  ['არქივი', counts.archived, 'archived'],
                  [
                    'ჩართული წყარო',
                    `${sources.filter((s) => s.enabled).length} / ${sources.length}`,
                    '',
                  ],
                ] as [string, number | string, string][]
              ).map(([name, count, filter]) => (
                <button
                  type="button"
                  key={name}
                  className={filter && status === filter ? 'stat-active' : ''}
                  disabled={!filter}
                  onClick={() => {
                    if (!filter) return;
                    setTab('vacancies');
                    setPage(1);
                    setStatus(filter);
                  }}
                >
                  <span>{name}</span>
                  <strong>{count}</strong>
                </button>
              ))}
            </div>
            <div className="admin-toolbar">
              <button
                className="primary"
                disabled={
                  busy || loading || counts.pending - counts.submissions <= 0
                }
                onClick={() => setConfirm({ action: 'bulk-publish' })}
              >
                {busy
                  ? 'მიმდინარეობს…'
                  : `შემოტანილის დადასტურება (${counts.pending - counts.submissions})`}
              </button>
              <div className="admin-search">
                <Search size={16} />
                <input
                  aria-label="ვაკანსიის ძებნა ადმინში"
                  placeholder="პოზიცია ან კომპანია"
                  value={query}
                  onChange={(e) => {
                    setPage(1);
                    setQuery(e.target.value);
                  }}
                />
              </div>
              <Choice
                label="სტატუსი"
                value={statusFilters[status] || 'ყველა'}
                onChange={(v) => {
                  setPage(1);
                  setStatus(
                    Object.entries(statusFilters).find(
                      ([, n]) => n === v,
                    )?.[0] || 'all',
                  );
                }}
                options={Object.values(statusFilters)}
              />
              <Choice
                label="წყარო"
                value={
                  sourceFilter
                    ? listingSourceNames[
                        sourceFilter as keyof typeof listingSourceNames
                      ] || sourceFilter
                    : 'ყველა'
                }
                onChange={(v) => {
                  setPage(1);
                  setSourceFilter(
                    Object.entries(listingSourceNames).find(
                      ([, n]) => n === v,
                    )?.[0] || '',
                  );
                }}
                options={Object.values(listingSourceNames)}
              />
              <button
                type="button"
                className="ds-btn ds-btn--secondary ds-btn--icon"
                onClick={() => void load()}
                aria-label="სიის განახლება"
              >
                <RefreshCw size={16} />
              </button>
            </div>
            {jobList()}
          </section>
        )}
        {tab === 'reports' && (
          <section className="admin-panel">
            <SectionHeading title="შეტყობინებები">
              მომხმარებლების შეტყობინებები: ვადაგასული, არასწორი ან დუბლიკატი.
            </SectionHeading>
            {tab === 'reports' && (
              <ReportsSection
                onChange={() => void load()}
                onOpenJob={(id) =>
                  void openJobById(id, () => {
                    setPage(1);
                    setTab('vacancies');
                  })
                }
              />
            )}
          </section>
        )}
        {tab === 'billing' && (
          <section className="admin-panel">
            <SectionHeading title="ინვოისები">
              ფასიანი განთავსებები, ინვოისები და შემოსავალი.
            </SectionHeading>
            {tab === 'billing' && (
              <BillingSettings
                key={billingVersion}
                onReview={(id) => void openJobById(id)}
              />
            )}
          </section>
        )}
        {tab === 'sources' && (
          <section className="admin-panel">
            <SectionHeading title="წყაროების მონიტორინგი">
              საიდან შემოდის ვაკანსიები: ბოლო შემოწმება, შედეგები და
              პარამეტრები.
            </SectionHeading>
            <section className="scraper-overview" aria-label="სკრაპერის მართვა">
              <div>
                <span className="scraper-eyebrow">ავტომატური განახლება</span>
                <h2>ვაკანსიების შემოტანა</h2>
                <p>ახალი ვაკანსიები მოწმდება და ქვეყნდება ავტომატურად.</p>
                <p className="scraper-schedule">
                  {commonInterval
                    ? `განრიგი: ყოველ ${commonInterval / 60} საათში.`
                    : sources.length
                      ? 'წყაროებს განსხვავებული ინტერვალი აქვს.'
                      : 'განრიგი იტვირთება…'}{' '}
                  დაგეგმილი გაშვება ზოგჯერ იგვიანებს.
                </p>
              </div>
              <div className="scraper-controls">
                <button
                  className="primary"
                  disabled={
                    busy ||
                    !sources.some((s) => s.enabled) ||
                    sources.some(
                      (s) =>
                        !!s.requested_at ||
                        sourceHealth(s, observedAt).tone === 'blue',
                    )
                  }
                  onClick={() =>
                    void sourceAction({ id: 'all' }, { action: 'run' })
                  }
                >
                  <RefreshCw size={16} />
                  ყველას შემოწმება
                </button>
                <button
                  className="secondary-button"
                  disabled={busy}
                  onClick={() =>
                    sources.some((s) => s.auto_enabled)
                      ? setConfirm({ action: 'pause-all-sources' })
                      : void sourceAction(
                          { id: 'all' },
                          { action: 'configure', autoEnabled: true },
                        )
                  }
                >
                  {sources.some((s) => s.auto_enabled)
                    ? 'ავტომატური ძებნის შეჩერება'
                    : 'ავტომატური ძებნის ჩართვა'}
                </button>
              </div>
              <div className="scraper-connection">
                <span>
                  <strong>
                    {sources.filter((s) => s.enabled && s.auto_enabled).length}{' '}
                    / {sources.length}
                  </strong>{' '}
                  წყაროზე ავტომატური ძებნაა ჩართული
                </span>
                {github?.latest && (
                  <a href={github.latest.url} target="_blank" rel="noreferrer">
                    <ExternalLink size={14} aria-hidden="true" />
                    ბოლო GitHub გაშვება: {time(github.latest.startedAt)} ·{' '}
                    {github.latest.status === 'completed'
                      ? github.latest.conclusion === 'success'
                        ? 'დასრულდა'
                        : 'შედეგი შესამოწმებელია'
                      : 'რიგშია / მიმდინარეობს'}
                  </a>
                )}
                {github && !github.available && (
                  <span>
                    GitHub-ის სტატუსი დროებით ვერ ჩაიტვირთა. ქვემოთ ბაზაში
                    შენახული შედეგებია.
                  </span>
                )}
              </div>
              {github && !github.dispatchConfigured && (
                <p className="scraper-setup-note">
                  პირდაპირი გაშვების კავშირი ჯერ არ არის დამატებული. ღილაკით
                  მოთხოვნა ინახება და GitHub-ის შემდეგ ავტომატურ ციკლში
                  სრულდება.
                </p>
              )}
            </section>
            <section
              className="scraper-results"
              aria-label="შემოტანის შედეგები"
            >
              <div className="scraper-results-heading">
                <h3>ბოლო 24 საათი</h3>
                <span>
                  განახლდა:{' '}
                  {observedAt
                    ? time(new Date(observedAt).toISOString())
                    : 'იტვირთება…'}
                </span>
              </div>
              <dl className="scraper-metrics">
                <div>
                  <dt>ახალი ვაკანსია</dt>
                  <dd>{summary?.imported ?? '—'}</dd>
                </div>
                <div>
                  <dt>განახლებული</dt>
                  <dd>{summary?.changed ?? '—'}</dd>
                </div>
                <div>
                  <dt>ვერ დამუშავდა</dt>
                  <dd>{summary?.failed ?? '—'}</dd>
                </div>
                <div>
                  <dt>დასრულებული გაშვება</dt>
                  <dd>{summary?.completed_runs ?? '—'}</dd>
                </div>
              </dl>
              <ScraperMetricsPanel metrics={scraperMetrics} />
              <ScraperLimits
                sources={sources}
                busy={busy}
                global
                onSave={(values) =>
                  void sourceAction(
                    { id: 'all' },
                    { action: 'configure', ...values },
                  )
                }
              />
              <div className="scraper-preferences">
                <label htmlFor="all-sources-interval">
                  ყველა წყაროს ინტერვალი
                  <SelectField
                    id="all-sources-interval"
                    disabled={busy || !sources.length}
                    value={commonInterval == null ? '' : String(commonInterval)}
                    placeholder="წყაროებს განსხვავებული ინტერვალი აქვს"
                    options={intervalOptions}
                    onChange={(v) =>
                      void sourceAction(
                        { id: 'all' },
                        { action: 'configure', intervalMinutes: Number(v) },
                      )
                    }
                  />
                </label>
                <button
                  className="secondary-button"
                  disabled={loading || busy}
                  onClick={() => void load()}
                >
                  <RefreshCw size={16} />
                  შედეგების განახლება
                </button>
                <a
                  href="https://console.neon.tech/app/projects/plain-sky-34116949"
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink size={14} aria-hidden="true" />
                  ბაზის მოხმარება
                </a>
              </div>
              <p className="admin-helper">
                შედეგები წუთში ერთხელ ახლდება, მხოლოდ გახსნილ ჩანართში.
                სახელმწიფო წყაროებისთვის Mac ჩართული უნდა იყოს.
              </p>
            </section>
            <div className="source-grid">
              {sources.map((s) => (
                <section className="source-card" key={s.id}>
                  <div className="source-card-head">
                    <div className="company-mark">
                      {s.id.slice(0, 2).toUpperCase()}
                    </div>
                    <h2>{s.name}</h2>
                    <span
                      className={`source-health health-${sourceHealth(s, observedAt).tone}`}
                    >
                      {sourceHealth(s, observedAt).label}
                    </span>
                  </div>
                  <p className="source-last">
                    <Clock3 size={14} />
                    ბოლო წარმატება: {time(s.last_success_at)}
                  </p>
                  <dl className="source-timing">
                    <div>
                      <dt>ბოლო აქტივობა</dt>
                      <dd>
                        {time(s.latest_run?.started_at || s.last_started_at)}
                      </dd>
                    </div>
                    <div>
                      <dt>შემდეგი შემოწმება</dt>
                      <dd>
                        {!s.enabled
                          ? 'წყარო გამორთულია'
                          : s.requested_at
                            ? 'გაშვების რიგშია'
                            : !s.auto_enabled
                              ? 'მხოლოდ მოთხოვნით'
                              : Date.parse(s.next_run_at) <= observedAt
                                ? ['hrgov', 'worknet'].includes(s.id)
                                  ? 'ლოკალური შემოწმების მოლოდინში'
                                  : 'ავტომატური გაშვების მოლოდინში'
                                : time(s.next_run_at)}
                      </dd>
                    </div>
                    {!!s.latest_run && (
                      <div>
                        <dt>ბოლო შედეგი</dt>
                        <dd>
                          {names[s.latest_run.status] || s.latest_run.status} ·
                          ახალი {s.latest_run.imported} · შეცვლილი{' '}
                          {s.latest_run.changed}
                        </dd>
                      </div>
                    )}
                  </dl>
                  <div className="source-numbers">
                    <span>
                      <strong>{s.discovered ?? s.imported}</strong> აღმოჩენილი
                    </span>
                    <span>
                      <strong>{s.queued}</strong> რიგში
                      {typeof s.due === 'number' && s.due !== s.queued
                        ? ` (${s.due} მზადაა)`
                        : ''}
                    </span>
                    {!!s.errored && (
                      <span>
                        <strong>{s.errored}</strong> შეცდომით
                      </span>
                    )}
                  </div>
                  <details className="source-settings">
                    <summary>
                      <ChevronDown
                        className="admin-summary-mark"
                        aria-hidden="true"
                      />
                      პარამეტრები და დეტალები
                    </summary>
                    {!!s.top_errors?.length && (
                      <details className="source-errors">
                        <summary>
                          <ChevronDown
                            className="admin-summary-mark"
                            aria-hidden="true"
                          />
                          ყველაზე ხშირი პასუხი წყაროდან ({s.errored})
                        </summary>
                        <ul>
                          {s.top_errors.map((e) => (
                            <li key={e.message}>
                              <b>{e.count}</b> {runMessage(e.message)}
                            </li>
                          ))}
                        </ul>
                        <small>
                          მოხსნილი განცხადება (404/410) ნორმალურია — ჩანაწერი
                          არქივში გადადის. სხვა შეცდომა მზარდი ინტერვალით
                          მოწმდება.
                        </small>
                      </details>
                    )}
                    {!!s.deferred_runs && (
                      <div className="source-repair-note">
                        <strong>ამ ქსელიდან წყარო არ პასუხობს</strong>
                        <p>
                          ბოლო სამ დღეში {s.deferred_runs} გაშვება ვერ
                          დაუკავშირდა წყაროს. სახელმწიფო წყაროების შემოტანისთვის
                          Mac ჩართული უნდა იყოს.
                        </p>
                      </div>
                    )}
                    {!!s.refresh_pending && (
                      <div className="source-repair-note">
                        <strong>
                          სრული ტექსტის განახლება: {s.refresh_pending}
                        </strong>
                        <p>
                          {s.refresh_retrying || 0} განცხადება განმეორებით
                          შემოწმებას ელოდება. ეს ახალი ვაკანსიების ძებნას აღარ
                          აჩერებს.
                        </p>
                        <button
                          className="text-button"
                          disabled={busy || !s.enabled}
                          onClick={() =>
                            void sourceAction(s, { action: 'retry' })
                          }
                        >
                          პრობლემურის ხელახალი შემოწმება
                        </button>
                      </div>
                    )}
                    {(s.quality_warning || !!s.quality_held) && (
                      <div className="source-quality-note">
                        <strong>ავტომატური ხელახალი შემოწმება</strong>
                        <p>
                          {s.quality_held
                            ? `${s.quality_held} განცხადების ცვლილება დამატებით მოწმდება. მანამდე შენარჩუნებულია ბოლო სანდო მონაცემები.`
                            : 'წყაროს რაოდენობა უჩვეულოდ შეიცვალა. დაფარვა ხელახლა მოწმდება.'}
                        </p>
                        <small>
                          ხელით დადასტურება საჭირო არ არის; ვადაგასული და
                          ხანგრძლივად გადაუმოწმებელი განცხადებები იხსნება.
                        </small>
                      </div>
                    )}
                    <div className="source-coverage">
                      <p>
                        დამუშავებული: <b>{s.imported}</b> · ლაივზე:{' '}
                        <b>{s.published_count ?? '—'}</b>
                      </p>
                      {!!s.removed_count && (
                        <p>
                          წყაროდან მოხსნილი: <b>{s.removed_count}</b>
                        </p>
                      )}
                      <p>
                        წყაროს მითითებული რაოდენობა:{' '}
                        <b>{s.reported_total ?? 'არ არის მითითებული'}</b>
                      </p>
                      <p>
                        ბოლო 24 საათში გავლილი გვერდები:{' '}
                        <b>{s.observed_pages ?? 0}</b>
                      </p>
                      <small>
                        წყაროს საერთო რაოდენობა შეიძლება შეიცავდეს დუბლიკატებსა
                        და ვადაგასულ განცხადებებს.
                      </small>
                    </div>
                    <label
                      className="check-row"
                      htmlFor={`source-enabled-${s.id}`}
                    >
                      <Checkbox
                        id={`source-enabled-${s.id}`}
                        checked={s.enabled}
                        disabled={busy}
                        onCheckedChange={(v) =>
                          void sourceAction(s, {
                            action: 'configure',
                            enabled: v,
                          })
                        }
                      />
                      წყაროს გამოყენება
                    </label>
                    <label
                      className="check-row"
                      htmlFor={`source-auto-${s.id}`}
                    >
                      <Checkbox
                        id={`source-auto-${s.id}`}
                        checked={s.auto_enabled}
                        disabled={busy}
                        onCheckedChange={(v) =>
                          void sourceAction(s, {
                            action: 'configure',
                            autoEnabled: v,
                          })
                        }
                      />
                      ახალი ვაკანსიების ავტომატური ძებნა
                    </label>
                    <label
                      className="check-row"
                      htmlFor={`source-publish-${s.id}`}
                    >
                      <Checkbox
                        id={`source-publish-${s.id}`}
                        checked={!!s.auto_publish}
                        disabled={busy}
                        onCheckedChange={(v) =>
                          void sourceAction(s, {
                            action: 'configure',
                            autoPublish: v,
                          })
                        }
                      />
                      შემოწმებული ვაკანსიების ავტომატური გამოქვეყნება
                    </label>
                    <div className="interval-row">
                      <span>სიის შემოწმება</span>
                      <SelectField
                        label={`${s.name}: შემოწმების ინტერვალი`}
                        value={String(s.interval_minutes)}
                        disabled={busy}
                        options={intervalOptions}
                        onChange={(v) =>
                          void sourceAction(s, {
                            action: 'configure',
                            intervalMinutes: Number(v),
                          })
                        }
                      />
                    </div>
                    <ScraperLimits
                      sources={[s]}
                      busy={busy}
                      onSave={(values) =>
                        void sourceAction(s, { action: 'configure', ...values })
                      }
                    />
                    <p className="admin-helper">
                      რეჟიმი: მხოლოდ ახალი ვაკანსიები. ერთხელ შენახული ჩანაწერი
                      აღარ მოწმდება.
                    </p>
                    {s.last_error && (
                      <div className="notice">
                        <p>
                          ბოლო შემოწმება სრულად ვერ დასრულდა. სისტემა
                          ავტომატურად გადაამოწმებს.
                        </p>
                        <details>
                          <summary>
                            <ChevronDown
                              className="admin-summary-mark"
                              aria-hidden="true"
                            />
                            შემოწმების დეტალები
                          </summary>
                          <p>{runMessage(s.last_error)}</p>
                        </details>
                      </div>
                    )}
                  </details>
                  <button
                    className="secondary-button"
                    disabled={
                      busy ||
                      !s.enabled ||
                      !!s.requested_at ||
                      sourceHealth(s, observedAt).tone === 'blue'
                    }
                    onClick={() => void sourceAction(s, { action: 'run' })}
                  >
                    <RefreshCw size={16} />
                    {s.requested_at
                      ? 'გაშვების რიგშია'
                      : github?.dispatchConfigured &&
                          !['hrgov', 'worknet'].includes(s.id)
                        ? 'ახლავე შემოწმება'
                        : 'შემოწმების მოთხოვნა'}
                  </button>
                </section>
              ))}
            </div>
            <p className="admin-helper">
              ავტომატური ძებნის შეჩერება ახალ გაშვებებს ეხება; უკვე მიმდინარე
              ციკლი დასრულდება. მოთხოვნილი ძველი ტექსტების აღდგენა ცალკე
              გრძელდება. ყველაფრის შესაჩერებლად გამორთე „წყაროს გამოყენება“.
              დროებითი შეცდომები რიგში რჩება და შემდეგ ციკლში მოწმდება.
            </p>
          </section>
        )}
        {tab === 'resumes' && (
          <section className="admin-panel">
            <SectionHeading title="CV-ები">
              PDF-ის ღილაკით შენახული რეზიუმეები.
            </SectionHeading>
            {tab === 'resumes' && <ResumesPanel />}
          </section>
        )}
        {tab === 'analytics' && (
          <section className="admin-panel">
            <SectionHeading title="ანალიტიკა">
              რას ეძებენ, რას ხსნიან და ვის უკავშირდებიან.
            </SectionHeading>
            {tab === 'analytics' && <AnalyticsPanel />}
          </section>
        )}
        {tab === 'history' && (
          <section className="admin-panel">
            <SectionHeading title="ცვლილებების ისტორია">
              ვინ რა შეცვალა და როდის.
            </SectionHeading>
            {tab === 'history' && (
              <HistoryPanel onOpenJob={(id) => void openJobById(id)} />
            )}
          </section>
        )}
        {tab === 'employers' && (
          <section className="admin-panel">
            <SectionHeading title="კომპანიები">
              ერთი კომპანიის სხვადასხვაგვარად დაწერილი სახელები — გაერთიანება ან
              გამოყოფა.
            </SectionHeading>
            {tab === 'employers' && <EmployersPanel />}
          </section>
        )}
        {tab === 'runs' && (
          <section className="admin-panel">
            <SectionHeading title="გაშვებები">
              ყოველი წყაროს ბოლო გაშვებები და მათი შედეგი.
            </SectionHeading>
            <div className="run-list ds-appear-list">
              {runs.map((r) => (
                <div className="run-row" key={r.id}>
                  <strong>
                    {listingSourceNames[
                      r.source_id as keyof typeof listingSourceNames
                    ] || r.source_id}
                  </strong>
                  <span className={`status status-${r.status}`}>
                    {names[r.status] || r.status}
                  </span>
                  <time dateTime={r.started_at}>{time(r.started_at)}</time>
                  <span className="run-counts">
                    ახალი: <b>{r.imported}</b> · შეცვლილი: <b>{r.changed}</b> ·
                    შეცდომა:{' '}
                    <b data-bad={r.failed > 0 || undefined}>{r.failed}</b>
                  </span>
                  {r.error && <p>{runMessage(r.error)}</p>}
                </div>
              ))}
              {!runs.length && (
                <div className="empty">
                  <History size={20} aria-hidden="true" />
                  <h3>გაშვება ჯერ არ ყოფილა</h3>
                  <p>წყაროს პირველი შემოწმების შემდეგ შედეგი აქ გამოჩნდება.</p>
                </div>
              )}
            </div>
          </section>
        )}
      </main>
      <Sheet
        open={!!selected}
        onOpenChange={(open) => {
          if (!open && !busy) setSelected(null);
        }}
      >
        <SheetContent className="edit-sheet">
          <SheetHeader>
            <SheetDescription>
              {[
                selected?.draft.company,
                submission && selected?.status === 'pending'
                  ? 'დადასტურებას ელოდება'
                  : selected
                    ? names[selected.status]
                    : '',
              ]
                .filter(Boolean)
                .join(' · ')}
            </SheetDescription>
            <SheetTitle className="detail-title">
              {submission
                ? 'დამსაქმებლის განცხადების შემოწმება'
                : 'ვაკანსიის შემოწმება'}
            </SheetTitle>
          </SheetHeader>
          {selected && draft && (
            <div className="edit-body">
              {submission && (
                <div className="submission-test">
                  <span>
                    {selected.is_test
                      ? 'მონიშნულია ტესტად: სტატისტიკასა და შემოსავალში არ ითვლება.'
                      : 'ნამდვილი დამსაქმებლის განცხადებაა? თუ ეს შენი ცდა იყო, მონიშნე ტესტად.'}
                  </span>
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={busy}
                    onClick={() => void markTest(!selected.is_test)}
                  >
                    {selected.is_test
                      ? 'ნამდვილად დაბრუნება'
                      : 'ტესტად მონიშვნა'}
                  </button>
                </div>
              )}
              {submission && (
                <VacancyAnalyticsBlock
                  key={selected.id}
                  data={selectedStats?.data?.[selected.id]}
                  error={selectedStats?.error}
                />
              )}
              {submission && <SubmissionSummary job={selected} draft={draft} />}
              {submission && (
                <section className="notice placement-choice">
                  <h3>განთავსება</h3>
                  <p>
                    {selected.placement_expires_at
                      ? `${placementLabels[selected.placement_tier]} აქტიურია ${time(selected.placement_expires_at)}-მდე. ხელახლა დადასტურება ვადას არ გააგრძელებს.`
                      : selected.vip_available
                        ? 'ამ კომპანიას უფასო VIP (14 დღე) ჯერ არ გამოუყენებია — VIP წინასწარ მოინიშნა. დაადასტურე, ან აირჩიე სტანდარტული.'
                        : 'ამ კომპანიას უფასო VIP უკვე გამოყენებული აქვს, ასე რომ სტანდარტული მოინიშნა.'}
                    {selected.requested_placement === 'premium' &&
                      ' დამსაქმებელმა პრემიუმი მოითხოვა — 20 ₾ / 14 დღე, აქტიურდება ჩარიცხვის დადასტურების შემდეგ.'}
                  </p>
                  <label htmlFor="admin-placement">
                    განთავსება დამტკიცებისას
                  </label>
                  <SelectField
                    id="admin-placement"
                    value={placement}
                    disabled={busy}
                    onChange={(v) => setPlacement(v as PlacementTier)}
                    options={placementTiers
                      .filter(
                        (t) =>
                          t === 'standard' ||
                          t === placement ||
                          (t === 'vip' && selected.vip_available) ||
                          (t === 'premium' && !!selected.invoice),
                      )
                      .map((t) => ({
                        value: t,
                        label:
                          placementLabels[t] +
                          (t === 'vip' && !selected.placement_expires_at
                            ? ' · უფასოდ 14 დღე'
                            : ''),
                      }))}
                  />
                </section>
              )}
              {selected.invoice && (
                <section className="notice editor-notice">
                  <h3>ინვოისი · {invoiceStatuses[selected.invoice.status]}</h3>
                  <a
                    className="editor-notice-link"
                    href={`/invoices/${selected.invoice.token}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink size={14} aria-hidden="true" />
                    {invoiceNumber(selected.invoice.number)} ·{' '}
                    {selected.invoice.amount_gel} ₾
                  </a>
                  {selected.invoice.status === 'pending' && (
                    <button
                      className="ds-btn ds-btn--secondary ds-btn--sm"
                      disabled={busy}
                      onClick={() => setConfirm({ action: 'confirm-payment' })}
                    >
                      ჩარიცხვის დადასტურება
                    </button>
                  )}
                  {selected.invoice.status === 'refund_required' && (
                    <button
                      className="ds-btn ds-btn--secondary ds-btn--sm"
                      disabled={busy}
                      onClick={() => setConfirm({ action: 'confirm-refund' })}
                    >
                      დაბრუნების დადასტურება
                    </button>
                  )}
                </section>
              )}
              <EditorWrap submission={submission}>
                <div className="editor-logo-row">
                  <CompanyLogo company={draft.company} url={draft.logoUrl} />
                  <div>
                    <strong>{draft.company}</strong>
                    <p>
                      {selected.requested_placement
                        ? 'ატვირთული ლოგო'
                        : 'ლოგო პირველწყაროდან'}{' '}
                      · გამოქვეყნებამდე გადაამოწმე
                    </p>
                  </div>
                  {draft.logoUrl && (
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={busy}
                      onClick={() => change('logoUrl', '')}
                    >
                      ლოგოს მოცილება
                    </button>
                  )}
                </div>
                {!submission && (
                  <div
                    className={
                      selected.automation_paused || !selected.automation_managed
                        ? 'notice editor-notice'
                        : 'automation-state editor-notice'
                    }
                  >
                    <strong>
                      {selected.automation_paused ||
                      !selected.automation_managed
                        ? 'ეს ჩანაწერი ხელით იმართება'
                        : 'ეს ჩანაწერი ავტომატურად იმართება'}
                    </strong>
                    <p>
                      {selected.automation_paused ||
                      !selected.automation_managed
                        ? 'წყაროს ახალი ტექსტი საჯარო ვერსიას აღარ ცვლის. ავტომატურ მართვას დაბრუნებისას წყაროს ბოლო შემოწმებული ვერსია აქვეყნებს ჩანაწერს და შენი რედაქცია გადაიწერება.'
                        : 'წყაროს ცვლილება ავტომატურად ქვეყნდება, ვადაგასული და მოხსნილი ჩანაწერი კი არქივდება. ქვემოთ ნებისმიერი შენახვა ამ ავტომატიზაციას აჩერებს.'}
                      {selected.automation_reason
                        ? ' მიზეზი: ' +
                          (automationReasons[selected.automation_reason] ||
                            selected.automation_reason) +
                          '.'
                        : ''}
                    </p>
                    <small>
                      ბოლო ავტომატური შემოწმება:{' '}
                      {time(selected.automation_checked_at)}
                    </small>
                    {!selected.items.some((i) => i.source_id === 'jobx') &&
                      (selected.automation_paused ||
                        !selected.automation_managed) && (
                        <button
                          className="ds-btn ds-btn--secondary ds-btn--sm"
                          disabled={busy}
                          onClick={() =>
                            setConfirm({ action: 'resume-automation' })
                          }
                        >
                          ავტომატურ მართვას დაბრუნება
                        </button>
                      )}
                  </div>
                )}
                {!!draft.warnings?.length && (
                  <div className="notice">
                    {draft.warnings.map((w) => (
                      <p key={w}>{w}</p>
                    ))}
                    <button
                      className="secondary-button"
                      onClick={() => change('warnings', [])}
                    >
                      გადავამოწმე
                    </button>
                  </div>
                )}
                {error && (
                  <p role="alert" className="notice">
                    {error}
                  </p>
                )}
                {!submission && (
                  <div className="editor-source-links">
                    {selected.items.map((i) => (
                      <a
                        key={i.id}
                        href={i.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink size={14} />
                        {listingSourceNames[
                          i.source_id as keyof typeof listingSourceNames
                        ] || i.source_id}
                      </a>
                    ))}
                  </div>
                )}
                <div className="edit-form">
                  <label className="full-width">
                    კომპანიის ლოგოს მისამართი
                    <input
                      value={draft.logoUrl || ''}
                      onChange={(e) => change('logoUrl', e.target.value)}
                      placeholder="https://…"
                    />
                  </label>
                  <label className="full-width">
                    განაკვეთი
                    <input
                      value={draft.employmentType || ''}
                      onChange={(e) => change('employmentType', e.target.value)}
                      placeholder="სრული განაკვეთი, ნახევარი განაკვეთი…"
                    />
                  </label>
                  <label>
                    პოზიცია
                    <input
                      value={draft.title}
                      onChange={(e) => change('title', e.target.value)}
                    />
                  </label>
                  <label>
                    კომპანია
                    <input
                      value={draft.company}
                      onChange={(e) => change('company', e.target.value)}
                    />
                  </label>
                  <label>
                    ქალაქი
                    <input
                      value={draft.city}
                      onChange={(e) => change('city', e.target.value)}
                    />
                  </label>
                  <label htmlFor="edit-category">
                    მიმართულება
                    <Choice
                      id="edit-category"
                      label="მიმართულება"
                      value={draft.category}
                      onChange={(v) =>
                        change('category', v === 'ყველა' ? 'სხვა' : v)
                      }
                      options={[...categories]}
                    />
                  </label>
                  <label>
                    ხელფასი — ზუსტად როგორც წყაროში
                    <input
                      value={draft.salary}
                      onChange={(e) => change('salary', e.target.value)}
                    />
                  </label>
                  <label>
                    მინიმალური თანხა
                    <input
                      type="number"
                      min="0"
                      value={draft.salaryMin ?? ''}
                      onChange={(e) =>
                        change(
                          'salaryMin',
                          e.target.value === '' ? null : Number(e.target.value),
                        )
                      }
                    />
                  </label>
                  <label>
                    ვალუტა
                    <input
                      placeholder="GEL / USD / EUR"
                      value={draft.currency}
                      onChange={(e) =>
                        change('currency', e.target.value.toUpperCase())
                      }
                    />
                  </label>
                  <label htmlFor="edit-period">
                    ანაზღაურების სიხშირე
                    <Choice
                      id="edit-period"
                      label="არ არის მითითებული"
                      value={draft.salaryPeriod || 'ყველა'}
                      options={['თვე', 'საათი', 'დღე', 'კვირა', 'წელი']}
                      onChange={(v) =>
                        change('salaryPeriod', v === 'ყველა' ? '' : v)
                      }
                    />
                  </label>
                  <label htmlFor="edit-mode">
                    სამუშაო რეჟიმი
                    <Choice
                      id="edit-mode"
                      label="არ არის მითითებული"
                      value={draft.mode || 'ყველა'}
                      options={['ადგილზე', 'დისტანციური', 'ჰიბრიდული']}
                      onChange={(v) => change('mode', v === 'ყველა' ? '' : v)}
                    />
                  </label>
                  <label htmlFor="edit-deadline">
                    ბოლო ვადა
                    <DateField
                      id="edit-deadline"
                      value={draft.deadline}
                      onChange={(v) => change('deadline', v)}
                    />
                  </label>
                  <label className="full-width">
                    აღწერა
                    <textarea
                      rows={13}
                      value={draft.description}
                      onChange={(e) => change('description', e.target.value)}
                    />
                  </label>
                </div>
                <CompanyEditor
                  key={draft.company}
                  name={draft.company}
                  sourceLogo={
                    draft.logoUrl ||
                    selected.items.find((i) => i.raw?.logoUrl)?.raw.logoUrl
                  }
                />
                {!!draft.facts?.length && (
                  <details className="raw-details">
                    <summary>
                      <ChevronDown
                        className="admin-summary-mark"
                        aria-hidden="true"
                      />
                      დამატებითი პირობების რედაქტირება ({draft.facts.length})
                    </summary>
                    <div className="metadata-editor">
                      {draft.facts.map((f, index) => (
                        <div key={index}>
                          <label>
                            {f.label}
                            <textarea
                              rows={2}
                              value={f.value}
                              onChange={(e) =>
                                change(
                                  'facts',
                                  draft.facts!.map((v, k) =>
                                    k === index
                                      ? { ...v, value: e.target.value }
                                      : v,
                                  ),
                                )
                              }
                            />
                          </label>
                          <button
                            type="button"
                            className="ds-btn ds-btn--danger ds-btn--sm"
                            onClick={() =>
                              change(
                                'facts',
                                draft.facts!.filter((_, k) => k !== index),
                              )
                            }
                          >
                            წაშლა
                          </button>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
                {!!draft.applicationLinks?.length && (
                  <details className="raw-details">
                    <summary>
                      <ChevronDown
                        className="admin-summary-mark"
                        aria-hidden="true"
                      />
                      განცხადების ბმულები ({draft.applicationLinks.length})
                    </summary>
                    <div className="metadata-editor">
                      {draft.applicationLinks.map((link, index) => (
                        <div key={index}>
                          <label>
                            {link.label}
                            <input
                              value={link.url}
                              onChange={(e) =>
                                change(
                                  'applicationLinks',
                                  draft.applicationLinks!.map((v, k) =>
                                    k === index
                                      ? { ...v, url: e.target.value }
                                      : v,
                                  ),
                                )
                              }
                            />
                          </label>
                          <button
                            type="button"
                            className="ds-btn ds-btn--danger ds-btn--sm"
                            onClick={() =>
                              change(
                                'applicationLinks',
                                draft.applicationLinks!.filter(
                                  (_, k) => k !== index,
                                ),
                              )
                            }
                          >
                            წაშლა
                          </button>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
                {!submission && (
                  <details className="raw-details">
                    <summary>
                      <ChevronDown
                        className="admin-summary-mark"
                        aria-hidden="true"
                      />
                      წყაროს ბოლო ვერსიის შედარება
                    </summary>
                    {selected.items.map((i) => (
                      <div key={i.id}>
                        <p>
                          {listingSourceNames[
                            i.source_id as keyof typeof listingSourceNames
                          ] || i.source_id}{' '}
                          · შემოწმდა {time(i.last_checked_at)} · შემდეგი{' '}
                          {time(i.next_check_at)}
                          {i.failures
                            ? ` · წარუმატებელი ცდა: ${i.failures}`
                            : ''}
                        </p>
                        {i.error && <p className="notice">{i.error}</p>}
                        {i.quality_warning && (
                          <p className="notice">
                            ხარისხის შემოწმება: {i.quality_warning}
                          </p>
                        )}
                        {!!i.raw?.warnings?.length && (
                          <div className="notice">
                            {i.raw.warnings.map((w) => (
                              <p key={w}>{w}</p>
                            ))}
                          </div>
                        )}
                        <CompanyLogo
                          company={i.raw?.company || ''}
                          url={i.raw?.logoUrl}
                        />
                        <h3>{i.raw?.title}</h3>
                        <p>
                          {i.raw?.salary} · {i.raw?.city} · {i.raw?.deadline}
                        </p>
                        <p className="raw-text">{i.raw?.description}</p>
                        {!!i.raw?.facts?.length && (
                          <div className="editor-extra-facts">
                            {i.raw.facts.map((f) => (
                              <div key={f.label}>
                                <strong>{f.label}</strong>
                                <span>{f.value}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        <button
                          className="secondary-button"
                          disabled={
                            busy || !i.raw || i.raw.company !== draft.company
                          }
                          onClick={() =>
                            setDraft(
                              (d) =>
                                d && {
                                  ...d,
                                  logoUrl: i.raw.logoUrl || '',
                                  employmentType: i.raw.employmentType || '',
                                  facts: i.raw.facts || [],
                                  applicationLinks:
                                    i.raw.applicationLinks || [],
                                  warnings: i.raw.warnings || [],
                                },
                            )
                          }
                        >
                          მხოლოდ ლოგოსა და დამატებითი დეტალების ჩასმა
                        </button>
                        <button
                          className="secondary-button"
                          disabled={busy}
                          onClick={() =>
                            setConfirm({ action: 'apply-source', itemId: i.id })
                          }
                        >
                          წყაროს ვერსიის ჩასმა რედაქციაში
                        </button>
                      </div>
                    ))}
                  </details>
                )}
              </EditorWrap>
              <JobHistory jobId={selected.id} />
              {selected.duplicates.length > 0 && (
                <div className="duplicates">
                  <h3>შესაძლო დუბლიკატები</h3>
                  <p>
                    შეადარე პირობები და ვადები. გაერთიანება ორივე წყაროს ბმულს
                    შეინარჩუნებს.
                  </p>
                  {selected.duplicates.map((d) => (
                    <div key={d.id}>
                      <span>
                        {d.company} — {d.title}
                      </span>
                      <button
                        className="secondary-button"
                        onClick={() =>
                          setConfirm({ action: 'merge', targetId: d.id })
                        }
                      >
                        გაერთიანება
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {submission && selected.status === 'pending' ? (
                <div className="editor-actions submission-actions">
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() => setConfirm({ action: 'publish' })}
                  >
                    <Check size={16} aria-hidden="true" />
                    დადასტურება და გამოქვეყნება
                  </button>
                  <button
                    className="ds-btn ds-btn--danger"
                    disabled={busy}
                    onClick={() => setConfirm({ action: 'reject' })}
                  >
                    უარყოფა
                  </button>
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() => void act('save')}
                  >
                    რედაქციის შენახვა
                  </button>
                </div>
              ) : (
                <div className="editor-actions">
                  <button
                    className="secondary-button"
                    disabled={busy}
                    onClick={() => void act('save')}
                  >
                    რედაქციის შენახვა
                  </button>
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() => setConfirm({ action: 'publish' })}
                  >
                    <Check size={16} aria-hidden="true" />
                    გამოქვეყნება
                  </button>
                  <button
                    className="ds-btn ds-btn--ghost"
                    disabled={busy}
                    onClick={() => setConfirm({ action: 'archive' })}
                  >
                    არქივში გადატანა
                  </button>
                  <button
                    className="ds-btn ds-btn--ghost admin-ghost-danger"
                    disabled={busy}
                    onClick={() => setConfirm({ action: 'reject' })}
                  >
                    უარყოფა
                  </button>
                  {['archived', 'rejected'].includes(selected.status) && (
                    <button
                      className="ds-btn ds-btn--ghost"
                      disabled={busy}
                      onClick={() => void act('restore')}
                    >
                      შემოტანილებში დაბრუნება
                    </button>
                  )}
                  {selected.needs_review && selected.status === 'published' && (
                    <button
                      className="ds-btn ds-btn--ghost"
                      disabled={busy}
                      onClick={() => void act('dismiss-update')}
                    >
                      არსებული ვერსიის დატოვება
                    </button>
                  )}
                </div>
              )}
              <p className="admin-helper">
                {submission
                  ? 'დამსაქმებლის განცხადება ავტომატურად არასდროს ქვეყნდება. დამსაქმებელს შეტყობინება არ იგზავნება.'
                  : 'ხელით შენახვა ამ ჩანაწერის ავტომატურ განახლებას აჩერებს. საჯარო ვერსიის შესაცვლელად გამოიყენე გამოქვეყნება. შეტყობინებები არ იგზავნება.'}
              </p>
            </div>
          )}
        </SheetContent>
      </Sheet>
      <Dialog
        open={!!confirm}
        onOpenChange={(open) => {
          if (!open && !busy) setConfirm(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirm?.action === 'pause-all-sources'
                ? 'ყველა წყაროზე ავტომატური ძებნა შევაჩეროთ?'
                : confirm?.action === 'bulk-publish'
                  ? 'ყველა შემოტანილი ვაკანსია გამოვაქვეყნოთ?'
                  : confirm?.action === 'publish'
                    ? submission
                      ? 'დავადასტუროთ და გამოვაქვეყნოთ?'
                      : 'გამოვაქვეყნოთ ეს ვერსია?'
                    : confirm?.action === 'reject' && submission
                      ? 'უარვყოფთ განცხადებას?'
                      : confirm?.action === 'merge'
                        ? 'გავაერთიანოთ ვაკანსიები?'
                        : confirm?.action === 'resume-automation'
                          ? 'ავტომატურ მართვას დავუბრუნოთ?'
                          : 'დაადასტურე ცვლილება'}
            </DialogTitle>
            <DialogDescription>
              {confirm?.action === 'pause-all-sources'
                ? 'ყველა წყაროზე შეჩერდება დაგეგმილი ავტომატური ძებნა. ხელახლა ჩართვა ამავე ღილაკით შეგიძლია.'
                : confirm?.action === 'confirm-payment'
                  ? 'დაადასტურე მხოლოდ მაშინ, თუ ინვოისის სრული თანხა უკვე ჩაირიცხა ანგარიშზე. ეს ღილაკი ბანკიდან მონაცემებს არ ამოწმებს.'
                  : confirm?.action === 'confirm-refund'
                    ? 'დაადასტურე მხოლოდ უკვე შესრულებული საბანკო დაბრუნება. ღილაკი თანხას არ რიცხავს.'
                    : confirm?.action === 'bulk-publish'
                      ? 'გამოქვეყნდება წყაროებიდან შემოტანილი ყველა მოლოდინში მყოფი ვაკანსია, ყველა გვერდიდან და ფილტრის მიუხედავად. დამსაქმებლის განცხადებები ამაში არ შედის — ისინი ცალ-ცალკე დასტურდება. ვადაგასული, არასწორი და გაუქმებული წყაროს ჩანაწერები გამოტოვდება. შეტყობინებები არ გაიგზავნება.'
                      : confirm?.action === 'publish'
                        ? 'ეს რედაქცია საიტზე გამოჩნდება. შეტყობინებები არ გაიგზავნება.'
                        : confirm?.action === 'apply-source'
                          ? 'წყაროს ტექსტი შენახულ რედაქციას ჩაანაცვლებს. საჯარო ვერსია უცვლელი დარჩება.'
                          : confirm?.action === 'merge'
                            ? 'არჩეული ვაკანსიის რედაქცია დარჩება, ამ ჩანაწერის წყაროები კი მას მიემატება.'
                            : confirm?.action === 'resume-automation'
                              ? 'წყაროს ბოლო შემოწმებული ვერსია ჩაანაცვლებს შენს რედაქციას და შემდგომ ცვლილებებსაც ავტომატურად გამოაქვეყნებს. ვადაგასული ან მოხსნილი ჩანაწერი არქივში გადავა.'
                              : 'ჩანაწერი საჯარო სიაში აღარ გამოჩნდება. აღდგენა ადმინიდან შეგიძლია.'}
            </DialogDescription>
          </DialogHeader>
          <div className="confirm-actions">
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() => setConfirm(null)}
            >
              გაუქმება
            </button>
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                confirm &&
                (confirm.action === 'pause-all-sources'
                  ? void sourceAction(
                      { id: 'all' },
                      { action: 'configure', autoEnabled: false },
                    ).finally(() => setConfirm(null))
                  : confirm.action === 'bulk-publish'
                    ? void publishAll()
                    : void act(confirm.action, {
                        itemId: confirm.itemId,
                        targetId: confirm.targetId,
                      }))
              }
            >
              დადასტურება
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
