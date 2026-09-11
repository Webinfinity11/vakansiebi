'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  ArrowUpRight,
  RefreshCw,
  ShieldCheck,
  BellOff,
  Check,
  Layers3,
  Search,
  LogOut,
  Clock3,
  ExternalLink,
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
import { categories, sourceNames } from '@/lib/types';
import { sourceHealth } from '@/lib/scraper-status';
import type { githubScraperStatus } from '@/lib/server/scraper-github';
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
export default function AdminPanel() {
  const [observedAt, setObservedAt] = useState(0);
  const [github, setGithub] = useState<Awaited<
    ReturnType<typeof githubScraperStatus>
  > | null>(null);
  const [tab, setTab] = useState('vacancies'),
    [status, setStatus] = useState('review'),
    [query, setQuery] = useState(''),
    [page, setPage] = useState(1),
    [jobs, setJobs] = useState<AdminJob[]>([]),
    [total, setTotal] = useState(0),
    [counts, setCounts] = useState({
      pending: 0,
      published: 0,
      review: 0,
      archived: 0,
    }),
    [sources, setSources] = useState<Source[]>([]),
    [runs, setRuns] = useState<SourceRun[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState<AdminJob | null>(null),
    [draft, setDraft] = useState<Vacancy | null>(null),
    [confirm, setConfirm] = useState<{
      action: string;
      itemId?: string;
      targetId?: string;
    } | null>(null);
  const load = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([
        request(
          `/api/admin/jobs?status=${status}&q=${encodeURIComponent(query)}&page=${page}`,
        ),
        request('/api/admin/sources'),
      ]);
      setJobs(a.jobs);
      setTotal(a.total);
      setCounts(a.counts);
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
  }, [status, query, page]);
  useEffect(() => {
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [load]);
  useEffect(() => {
    const t = setInterval(() => {
      if (!selected && !busy) void load();
    }, 10000);
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
        ...extras,
      });
      setSelected(null);
      setConfirm(null);
      setMessage(
        action === 'publish'
          ? 'ვაკანსია გამოქვეყნდა. შეტყობინება არ გაგზავნილა.'
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
            <h1>ყველაფერი შენი კონტროლით.</h1>
            <p>შეამოწმე შემოტანილი ვაკანსიები, გაასწორე და გამოაქვეყნე.</p>
          </div>
          <Link href="/?preview=1" target="_blank" className="secondary-button">
            წინასწარი ნახვა <ArrowUpRight size={17} />
          </Link>
        </div>
        <div className="test-notice">
          <BellOff size={19} />
          <div>
            <strong>ავტომატური მართვა</strong>
            <span>
              {' '}
              ჩართული წყაროების ვაკანსიები ავტომატურად მოწმდება და ქვეყნდება.
              ელფოსტა, SMS და სხვა შეტყობინებები არ იგზავნება.
            </span>
          </div>
        </div>
        <div className="admin-stats">
          {[
            ['შემოტანილი', counts.pending],
            ['შესამოწმებელი', counts.review],
            ['გამოქვეყნებული', counts.published],
            ['წყარო', sources.length],
          ].map(([name, count]) => (
            <div key={name}>
              <span>{name}</span>
              <strong>{count}</strong>
            </div>
          ))}
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
        <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
          <TabsList variant="line" className="admin-tabs">
            <TabsTrigger value="vacancies">ვაკანსიები</TabsTrigger>
            <TabsTrigger value="sources">წყაროები და განახლება</TabsTrigger>
            <TabsTrigger value="runs">შემოტანის ისტორია</TabsTrigger>
          </TabsList>
          <TabsContent value="vacancies">
            <div className="admin-toolbar">
              <button
                className="primary"
                disabled={busy || loading || counts.pending === 0}
                onClick={() => setConfirm({ action: 'bulk-publish' })}
              >
                {busy
                  ? 'მიმდინარეობს…'
                  : `ყველას დადასტურება (${counts.pending})`}
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
                value={
                  {
                    review: 'შესამოწმებელი',
                    all: 'ყველა',
                    pending: 'შემოტანილი',
                    published: 'გამოქვეყნებული',
                    archived: 'არქივი',
                    rejected: 'უარყოფილი',
                  }[status] || 'ყველა'
                }
                onChange={(v) => {
                  setPage(1);
                  setStatus(
                    Object.entries({
                      review: 'შესამოწმებელი',
                      all: 'ყველა',
                      pending: 'შემოტანილი',
                      published: 'გამოქვეყნებული',
                      archived: 'არქივი',
                      rejected: 'უარყოფილი',
                    }).find(([, n]) => n === v)?.[0] || 'all',
                  );
                }}
                options={[
                  'შესამოწმებელი',
                  'შემოტანილი',
                  'გამოქვეყნებული',
                  'არქივი',
                  'უარყოფილი',
                ]}
              />
              <button
                className="icon-button"
                onClick={() => void load()}
                aria-label="სიის განახლება"
              >
                <RefreshCw size={18} />
              </button>
            </div>
            {loading ? (
              <p className="empty">იტვირთება…</p>
            ) : !jobs.length ? (
              <div className="empty">
                <Layers3 size={32} />
                <h3>ამ სიაში ვაკანსიები ჯერ არ არის</h3>
                <p>
                  წყაროების ჩანართიდან გაუშვი შემოწმება ან აირჩიე სხვა სტატუსი.
                </p>
              </div>
            ) : (
              <div className="admin-job-list">
                {jobs.map((j) => (
                  <button
                    className="admin-job"
                    key={j.id}
                    onClick={() => {
                      setSelected(j);
                      setDraft(j.draft);
                      setError('');
                    }}
                  >
                    <CompanyLogo
                      company={j.draft.company}
                      url={j.draft.logoUrl}
                    />
                    <div className="admin-job-text">
                      <span>
                        {j.draft.company} · {j.draft.source}
                      </span>
                      <strong>{j.draft.title}</strong>
                      <small>
                        {j.draft.city || 'ქალაქი დასაზუსტებელია'} ·{' '}
                        {j.draft.salary || 'ხელფასი მითითებული არ არის'}
                      </small>
                    </div>
                    <div className="admin-job-status">
                      <span className={`status status-${j.status}`}>
                        {names[j.status]}
                      </span>
                      {j.needs_review && j.status !== 'pending' && (
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
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
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
          </TabsContent>
          <TabsContent value="sources">
            <section className="scraper-overview" aria-label="სკრაპერის მართვა">
              <div>
                <span className="scraper-eyebrow">GITHUB ACTIONS</span>
                <h2>ავტომატური შემოტანის მართვა</h2>
                <p>
                  სკრაპერი GitHub-ზე მუშაობს. შენი კომპიუტერის ჩართვა საჭირო არ
                  არის.
                </p>
                <p className="scraper-schedule">
                  გაშვების განრიგი: ყოველ 30 წუთში · GitHub-ს შეუძლია გაშვება
                  დააგვიანოს. მონაცემები აქ ყოველ 10 წამში ახლდება.
                </p>
              </div>
              <div className="scraper-controls">
                <button
                  className="primary"
                  disabled={busy || !sources.some((s) => s.enabled)}
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
                                ? 'GitHub-ის შემდეგ ციკლში'
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
                    </span>
                  </div>
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
                    <p>
                      წყაროს მითითებული რაოდენობა:{' '}
                      <b>{s.reported_total ?? 'არ არის მითითებული'}</b>
                    </p>
                    <p>
                      ბოლო 24 საათში გავლილი გვერდები:{' '}
                      <b>{s.observed_pages ?? 0}</b>
                    </p>
                    <small>
                      წყაროს საერთო რაოდენობა შეიძლება შეიცავდეს დუბლიკატებსა და
                      ვადაგასულ განცხადებებს.
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
                  <label className="check-row" htmlFor={`source-auto-${s.id}`}>
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
                      <option value={30}>30 წუთი</option>
                      <option value={60}>1 საათი</option>
                      <option value={180}>3 საათი</option>
                      <option value={1440}>24 საათი</option>
                    </select>
                  </div>
                  <p className="source-last">
                    არსებული ვაკანსიების ხელახალი შემოწმების სამიზნე ინტერვალი:{' '}
                    {s.detail_interval_hours} საათი · რიგის მიხედვით
                  </p>
                  {s.last_error && (
                    <div className="notice">
                      <p>
                        ბოლო შემოწმება სრულად ვერ დასრულდა. სისტემა ავტომატურად
                        გადაამოწმებს.
                      </p>
                      <details>
                        <summary>შემოწმების დეტალები</summary>
                        <p>{s.last_error}</p>
                      </details>
                    </div>
                  )}
                  <button
                    className="secondary-button"
                    disabled={busy || !s.enabled}
                    onClick={() => void sourceAction(s, { action: 'run' })}
                  >
                    <RefreshCw size={16} />
                    {s.requested_at
                      ? 'გაშვების ხელახლა მოთხოვნა'
                      : github?.dispatchConfigured
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
          <TabsContent value="runs">
            <div className="run-list">
              {runs.map((r) => (
                <div className="run-row" key={r.id}>
                  <strong>
                    {sourceNames[r.source_id as keyof typeof sourceNames] ||
                      r.source_id}
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
              {selected ? names[selected.status] : ''}
            </SheetDescription>
            <SheetTitle className="detail-title">
              ვაკანსიის შემოწმება
            </SheetTitle>
          </SheetHeader>
          {selected && draft && (
            <div className="edit-body">
              <div className="editor-logo-row">
                <CompanyLogo company={draft.company} url={draft.logoUrl} />
                <div>
                  <strong>{draft.company}</strong>
                  <p>ლოგო პირველწყაროდან · გამოქვეყნებამდე გადაამოწმე</p>
                </div>
              </div>
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
              <div className="editor-source-links">
                {selected.items.map((i) => (
                  <a
                    key={i.id}
                    href={i.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink size={14} />
                    {sourceNames[i.source_id as keyof typeof sourceNames] ||
                      i.source_id}
                  </a>
                ))}
              </div>
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
                    options={categories}
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
                  ანაზღაურების პერიოდი
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
              <details className="raw-details">
                <summary>წყაროს ბოლო ვერსიის შედარება</summary>
                {selected.items.map((i) => (
                  <div key={i.id}>
                    <p>
                      {i.source_id} · {time(i.last_checked_at)}
                    </p>
                    {i.error && <p className="notice">{i.error}</p>}
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
                              applicationLinks: i.raw.applicationLinks || [],
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
              <p className="admin-helper">
                ხელით შენახვა ამ ჩანაწერის ავტომატურ განახლებას აჩერებს. საჯარო
                ვერსიის შესაცვლელად გამოიყენე გამოქვეყნება. შეტყობინებები არ
                იგზავნება.
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
                  ? 'გამოვაქვეყნოთ ეს ვერსია?'
                  : confirm?.action === 'merge'
                    ? 'გავაერთიანოთ ვაკანსიები?'
                    : 'დაადასტურე ცვლილება'}
            </DialogTitle>
            <DialogDescription>
              {confirm?.action === 'bulk-publish'
                ? 'გამოქვეყნდება ყველა მოლოდინში მყოფი ვაკანსიის შენახული რედაქცია, ყველა გვერდიდან და ფილტრის მიუხედავად. ვადაგასული, არასწორი და გაუქმებული წყაროს ჩანაწერები გამოტოვდება. შეტყობინებები არ გაიგზავნება.'
                : confirm?.action === 'publish'
                  ? 'ეს რედაქცია საიტზე გამოჩნდება. შეტყობინებები არ გაიგზავნება.'
                  : confirm?.action === 'apply-source'
                    ? 'წყაროს ტექსტი შენახულ რედაქციას ჩაანაცვლებს. საჯარო ვერსია უცვლელი დარჩება.'
                    : confirm?.action === 'merge'
                      ? 'არჩეული ვაკანსიის რედაქცია დარჩება, ამ ჩანაწერის წყაროები კი მას მიემატება.'
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
