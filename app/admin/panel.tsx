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
  ArrowUpRight,
  RefreshCw,
  ShieldCheck,
  Check,
  Layers3,
  Search,
  LogOut,
  Clock3,
  ExternalLink,
  Inbox,
  ListChecks,
  ReceiptText,
  DatabaseZap,
  History,
  BarChart3,
  Building2,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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
import { ReportsSection } from './reports';
import type { githubScraperStatus } from '@/lib/server/scraper-github';
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
const time = (v: string | null) =>
  v
    ? new Date(v).toLocaleString('en-GB', {
        timeZone: 'Asia/Tbilisi',
        dateStyle: 'short',
        timeStyle: 'short',
      })
    : 'ჯერ არ შემოწმებულა';
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
      <summary>რედაქტირება დადასტურებამდე</summary>
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
      'განთავსება',
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
  const [tab, setTab] = useState('submissions'),
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
    }),
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
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, b] = await Promise.all([
        tab === 'vacancies'
          ? request(
              `/api/admin/jobs?status=${status}&q=${encodeURIComponent(query)}&page=${page}&source=${sourceFilter}`,
            )
          : tab === 'submissions'
            ? request(`/api/admin/jobs?status=submissions&page=${page}`)
            : Promise.resolve(null),
        request('/api/admin/sources'),
      ]);
      if (a) {
        setJobs(a.jobs);
        setTotal(a.total);
      }
      setCounts(b.summary.counts);
      setSummary(b.summary);
      setSources(b.sources);
      setRuns(b.runs);
      setGithub(b.github);
      setObservedAt(Date.parse(b.observedAt));
      setError('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [status, query, page, sourceFilter, tab]);
  useEffect(() => {
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [load]);
  useEffect(() => {
    // Full editorial snapshots are expensive; hidden tabs must not poll them.
    const t = setInterval(() => {
      if (document.visibilityState === 'visible' && !selected && !busy)
        void load();
    }, 60000);
    return () => clearInterval(t);
  }, [load, selected, busy]);
  const act = async (action: string, extras: Record<string, unknown> = {}) => {
    if (!selected) return;
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
      setSelected(null);
      setBillingVersion((v) => v + 1);
      setConfirm(null);
      setMessage(
        action === 'publish'
          ? 'ვაკანსია გამოქვეყნდა. შეტყობინება არ გაგზავნილა.'
          : action === 'reject'
            ? 'განცხადება უარყოფილია. შეტყობინება არ გაგზავნილა.'
            : 'ცვლილება შენახულია.',
      );
      await load();
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
    setPlacement(
      j.placement_expires_at
        ? j.placement_tier
        : j.requested_placement || 'standard',
    );
    setError('');
  };
  const submission = !!selected?.submitted_at;
  const jobList = () => (
    <>
      {loading ? (
        <p className="empty">იტვირთება…</p>
      ) : !jobs.length ? (
        <div className="empty">
          <Layers3 size={32} />
          {tab === 'submissions' ? (
            <>
              <h3>ახალი განცხადება არ არის</h3>
              <p>დამსაქმებლის გაგზავნილი ვაკანსია აქ გამოჩნდება.</p>
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
        <div className="admin-job-list">
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
                    <span className="review-label">
                      {placementLabels[j.requested_placement]}
                    </span>
                  )}
                {!j.submitted_at &&
                  (j.automation_paused || !j.automation_managed) && (
                    <span className="review-label">ხელით მართული</span>
                  )}
                {!j.submitted_at &&
                  j.automation_reason &&
                  j.status !== 'published' && (
                    <span className="review-label">
                      {automationReasons[j.automation_reason] ||
                        j.automation_reason}
                    </span>
                  )}
                {j.needs_review &&
                  !['pending', 'rejected'].includes(j.status) && (
                    <span className="review-label">
                      ცვლილება შესამოწმებელია
                    </span>
                  )}
                {j.duplicates.length > 0 && (
                  <span className="review-label">შესაძლო დუბლიკატი</span>
                )}
                <ArrowUpRight size={17} />
              </div>
            </button>
          ))}
        </div>
      )}
      <div className="admin-pagination">
        <span>{total} ჩანაწერი</span>
        <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
          წინა
        </button>
        <span>{page}</span>
        <button
          disabled={page * 30 >= total}
          onClick={() => setPage((p) => p + 1)}
        >
          შემდეგი
        </button>
      </div>
    </>
  );
  return (
    <>
      <header className="topbar admin-topbar">
        <div className="header-inner">
          <Brand />
          <nav>
            <Link href="/">ვაკანსიები</Link>
            <Link href="/admin" className="nav-active">
              ადმინის სივრცე
            </Link>
          </nav>
          <button
            className="logout"
            onClick={async () => {
              await fetch('/api/admin/session', { method: 'DELETE' });
              window.location.assign('/admin');
            }}
          >
            <LogOut size={16} />
            გასვლა
          </button>
        </div>
      </header>
      <main className="page admin-page">
        <div className="admin-heading">
          <div>
            <div className="eyebrow">
              <ShieldCheck size={16} />
              მართვის სივრცე
            </div>
            <h1>ადმინისტრაცია</h1>
            <p>შემოტანის შედეგები და მართვა ერთ სივრცეში.</p>
          </div>
          <Link href="/?preview=1" target="_blank" className="secondary-button">
            წინასწარი ნახვა <ArrowUpRight size={17} />
          </Link>
        </div>
        {error && (
          <div role="alert" className="notice">
            {error}
          </div>
        )}
        {message && (
          <output className="success-note">
            <Check size={17} />
            {message}
            <button
              onClick={() => setMessage('')}
              aria-label="შეტყობინების დახურვა"
            >
              ×
            </button>
          </output>
        )}
        <Tabs
          value={tab}
          orientation="vertical"
          className="admin-layout"
          onValueChange={(v) => {
            setPage(1);
            setTab(String(v));
          }}
        >
          <TabsList variant="line" className="admin-tabs">
            <TabsTrigger value="submissions">
              <Inbox size={17} />
              <span>დამსაქმებლის განცხადებები</span>
              {counts.submissions > 0 && <b>{counts.submissions}</b>}
            </TabsTrigger>
            <TabsTrigger value="vacancies">
              <ListChecks size={17} />
              <span>ვაკანსიები</span>
            </TabsTrigger>
            <TabsTrigger value="billing">
              <ReceiptText size={17} />
              <span>ინვოისები</span>
            </TabsTrigger>
            <TabsTrigger value="sources">
              <DatabaseZap size={17} />
              <span>წყაროები და განახლება</span>
            </TabsTrigger>
            <TabsTrigger value="runs">
              <History size={17} />
              <span>შემოტანის ისტორია</span>
            </TabsTrigger>
            <TabsTrigger value="analytics">
              <BarChart3 size={17} />
              <span>ანალიტიკა</span>
            </TabsTrigger>
            <TabsTrigger value="employers">
              <Building2 size={17} />
              <span>კომპანიების სახელები</span>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="submissions">
            <div className="admin-section-heading">
              <h2>დამსაქმებლის განცხადებები</h2>
              <p>
                ვაკანსია, რომელიც დამსაქმებელმა საიტის ფორმით გამოგზავნა, საიტზე
                მხოლოდ შენი დადასტურების შემდეგ გამოჩნდება. გახსენი, გადაამოწმე
                და დაადასტურე ან უარყავი.
              </p>
            </div>
            {jobList()}
          </TabsContent>
          <TabsContent value="vacancies">
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
                <Search size={18} />
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
                className="icon-button"
                onClick={() => void load()}
                aria-label="სიის განახლება"
              >
                <RefreshCw size={18} />
              </button>
            </div>
            {jobList()}
          </TabsContent>
          <TabsContent value="billing">
            {tab === 'billing' && (
              <BillingSettings
                key={billingVersion}
                onReview={async (id) => {
                  try {
                    const data = await request(
                      `/api/admin/jobs?status=all&id=${id}`,
                    );
                    const j = data.jobs[0] as AdminJob | undefined;
                    if (!j) throw Error('განცხადება ვერ მოიძებნა');
                    openJob(j);
                  } catch (e) {
                    setError(
                      e instanceof Error ? e.message : 'ჩატვირთვა ვერ მოხერხდა',
                    );
                  }
                }}
              />
            )}
          </TabsContent>
          <TabsContent value="sources">
            {tab === 'sources' && <ReportsSection />}
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
                    void sourceAction(
                      { id: 'all' },
                      {
                        action: 'configure',
                        autoEnabled: !sources.some((s) => s.auto_enabled),
                      },
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
                    ბოლო GitHub გაშვება: {time(github.latest.startedAt)} ·{' '}
                    {github.latest.status === 'completed'
                      ? github.latest.conclusion === 'success'
                        ? 'დასრულდა'
                        : 'შედეგი შესამოწმებელია'
                      : 'რიგშია / მიმდინარეობს'}{' '}
                    <ExternalLink size={13} />
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
                  <dt>შემოტანილი</dt>
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
              <div className="scraper-preferences">
                <label>
                  ყველა წყაროს ინტერვალი
                  <select
                    className="choice"
                    aria-label="ყველა წყაროს ინტერვალი"
                    disabled={busy || !sources.length}
                    value={commonInterval ?? ''}
                    onChange={(e) =>
                      void sourceAction(
                        { id: 'all' },
                        {
                          action: 'configure',
                          intervalMinutes: Number(e.target.value),
                        },
                      )
                    }
                  >
                    <option value="" disabled>
                      წყაროებს განსხვავებული ინტერვალი აქვს
                    </option>
                    <option value={180}>3 საათი</option>
                    <option value={360}>6 საათი</option>
                    <option value={720}>12 საათი</option>
                    <option value={1440}>24 საათი</option>
                  </select>
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
                  ბაზის მოხმარება <ExternalLink size={14} />
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
                    <Clock3 size={15} />
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
                    <summary>პარამეტრები და დეტალები</summary>
                    {!!s.top_errors?.length && (
                      <details className="source-errors">
                        <summary>
                          ყველაზე ხშირი პასუხი წყაროდან ({s.errored})
                        </summary>
                        <ul>
                          {s.top_errors.map((e) => (
                            <li key={e.message}>
                              <b>{e.count}</b> {e.message}
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
                      <select
                        className="choice"
                        aria-label={`${s.name}: შემოწმების ინტერვალი`}
                        value={s.interval_minutes}
                        disabled={busy}
                        onChange={(e) =>
                          void sourceAction(s, {
                            action: 'configure',
                            intervalMinutes: Number(e.target.value),
                          })
                        }
                      >
                        <option value={180}>3 საათი</option>
                        <option value={360}>6 საათი</option>
                        <option value={720}>12 საათი</option>
                        <option value={1440}>24 საათი</option>
                      </select>
                    </div>
                    <div className="interval-row">
                      <span>ვაკანსიის ხელახალი შემოწმება</span>
                      <select
                        className="choice"
                        aria-label={`${s.name}: დეტალის შემოწმების ინტერვალი`}
                        value={s.detail_interval_hours}
                        disabled={busy}
                        onChange={(e) =>
                          void sourceAction(s, {
                            action: 'configure',
                            detailIntervalHours: Number(e.target.value),
                          })
                        }
                      >
                        <option value={6}>6 საათი</option>
                        <option value={12}>12 საათი</option>
                        <option value={24}>24 საათი</option>
                        <option value={48}>2 დღე</option>
                        <option value={168}>7 დღე</option>
                      </select>
                    </div>
                    <p className="admin-helper">
                      უფრო გრძელი ინტერვალი ახალ ვაკანსიებს მეტ ადგილს უთმობს
                      გაშვების ბიუჯეტში; სიიდან გამქრალი ჩანაწერები ისედაც
                      პირველ რიგში მოწმდება.
                    </p>
                    {s.last_error && (
                      <div className="notice">
                        <p>
                          ბოლო შემოწმება სრულად ვერ დასრულდა. სისტემა
                          ავტომატურად გადაამოწმებს.
                        </p>
                        <details>
                          <summary>შემოწმების დეტალები</summary>
                          <p>{s.last_error}</p>
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
          </TabsContent>
          <TabsContent value="analytics">
            {tab === 'analytics' && <AnalyticsPanel />}
          </TabsContent>
          <TabsContent value="employers">
            {tab === 'employers' && <EmployersPanel />}
          </TabsContent>
          <TabsContent value="runs">
            <div className="run-list">
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
                  <span>{time(r.started_at)}</span>
                  <span>
                    ახალი: {r.imported} · შეცვლილი: {r.changed} · შეცდომა:{' '}
                    {r.failed}
                  </span>
                  {r.error && <p>{r.error}</p>}
                </div>
              ))}
              {!runs.length && (
                <p className="empty">შემოტანის ისტორია ჯერ ცარიელია.</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
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
              {selected?.draft.company} ·{' '}
              {submission && selected?.status === 'pending'
                ? 'დადასტურებას ელოდება'
                : selected
                  ? names[selected.status]
                  : ''}
            </SheetDescription>
            <SheetTitle className="detail-title">
              {submission
                ? 'დამსაქმებლის განცხადების შემოწმება'
                : 'ვაკანსიის შემოწმება'}
            </SheetTitle>
          </SheetHeader>
          {selected && draft && (
            <div className="edit-body">
              {submission && <SubmissionSummary job={selected} draft={draft} />}
              {/* A standard request has nothing to decide here; only a requested or active
                  VIP/premium placement needs the tier choice. */}
              {selected.requested_placement &&
                (selected.requested_placement !== 'standard' ||
                  selected.placement_expires_at) && (
                  <section className="notice">
                    <h3>
                      დამსაქმებლის განცხადება ·{' '}
                      {placementLabels[selected.requested_placement]}
                    </h3>
                    <p>
                      {selected.requested_placement === 'premium'
                        ? 'პრემიუმი — 20 ₾ / 14 დღე, აქტიურდება ჩარიცხვის დადასტურების შემდეგ.'
                        : 'პირველი VIP უფასოა 14 დღით — ერთხელ თითო კომპანიაზე.'}{' '}
                      გადაამოწმე დამსაქმებლის ვინაობა და მისი უფლებამოსილება;
                      განსხვავებული სახელით განმეორებითი საჩუქარი არ დაუშვა.
                    </p>
                    <label htmlFor="admin-placement">
                      განთავსება დამტკიცებისას
                    </label>
                    <select
                      id="admin-placement"
                      value={placement}
                      disabled={busy}
                      onChange={(e) =>
                        setPlacement(e.target.value as PlacementTier)
                      }
                    >
                      {placementTiers
                        .filter(
                          (t) =>
                            placementTiers.indexOf(t) <=
                            placementTiers.indexOf(
                              selected.requested_placement || 'standard',
                            ),
                        )
                        .map((t) => (
                          <option key={t} value={t}>
                            {placementLabels[t]}
                          </option>
                        ))}
                    </select>
                    {selected.placement_expires_at && (
                      <p>
                        გამოკვეთის ბოლო ვადა:{' '}
                        {time(selected.placement_expires_at)}. რედაქტირება ვადას
                        არ გააგრძელებს.
                      </p>
                    )}
                  </section>
                )}
              {selected.invoice && (
                <section className="notice">
                  <h3>ინვოისი · {invoiceStatuses[selected.invoice.status]}</h3>
                  <a
                    href={`/invoices/${selected.invoice.token}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {invoiceNumber(
                      selected.invoice.number,
                      selected.invoice.created_at,
                    )}{' '}
                    · {selected.invoice.amount_gel} ₾
                  </a>
                  {selected.invoice.status === 'pending' && (
                    <button
                      className="secondary-button"
                      disabled={busy}
                      onClick={() => setConfirm({ action: 'confirm-payment' })}
                    >
                      ჩარიცხვის დადასტურება
                    </button>
                  )}
                  {selected.invoice.status === 'refund_required' && (
                    <button
                      className="secondary-button"
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
                        ? 'notice'
                        : 'automation-state'
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
                          className="secondary-button"
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
                  <label>
                    ბოლო ვადა
                    <input
                      type="date"
                      value={draft.deadline}
                      onChange={(e) => change('deadline', e.target.value)}
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
                    <summary>წყაროს ბოლო ვერსიის შედარება</summary>
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
                    დადასტურება და გამოქვეყნება <Check size={17} />
                  </button>
                  <button
                    className="secondary-button"
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
                    გამოქვეყნება <Check size={17} />
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => setConfirm({ action: 'archive' })}
                  >
                    არქივში გადატანა
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => setConfirm({ action: 'reject' })}
                  >
                    უარყოფა
                  </button>
                  {['archived', 'rejected'].includes(selected.status) && (
                    <button disabled={busy} onClick={() => void act('restore')}>
                      შემოტანილებში დაბრუნება
                    </button>
                  )}
                  {selected.needs_review && selected.status === 'published' && (
                    <button
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
              {confirm?.action === 'bulk-publish'
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
              {confirm?.action === 'confirm-payment'
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
                (confirm.action === 'bulk-publish'
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
    </>
  );
}
