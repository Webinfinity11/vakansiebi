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
import type { AdminJob, Source, Vacancy, SourceRun } from '@/lib/types';
import { categories } from '@/lib/types';
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
  interrupted: 'შეწყდა',
};
const time = (v: string | null) =>
  v
    ? new Date(v).toLocaleString('ka-GE', {
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
  const sourceAction = async (s: Source, body: Record<string, unknown>) => {
    setBusy(true);
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
  const change = (key: keyof Vacancy, value: string | number | null) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  return (
    <>
      <header className="topbar">
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
            <strong>სატესტო რეჟიმი</strong>
            <span>
              {' '}
              გამოქვეყნება მხოლოდ ხელით ხდება. ელფოსტა, SMS და სხვა
              შეტყობინებები არ იგზავნება.
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
                    <div className="company-mark">
                      {j.draft.company.slice(0, 2).toUpperCase()}
                    </div>
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
            <div className="source-grid">
              {sources.map((s) => (
                <section className="source-card" key={s.id}>
                  <div className="source-card-head">
                    <div className="company-mark">
                      {s.id.slice(0, 2).toUpperCase()}
                    </div>
                    <h2>{s.name}</h2>
                    <span
                      className={`status ${s.enabled ? 'status-published' : 'status-archived'}`}
                    >
                      {s.enabled ? 'ჩართულია' : 'გამორთულია'}
                    </span>
                  </div>
                  <p className="source-last">
                    <Clock3 size={15} />
                    ბოლო წარმატება: {time(s.last_success_at)}
                  </p>
                  <div className="source-numbers">
                    <span>
                      <strong>{s.imported}</strong> შემოტანილი
                    </span>
                    <span>
                      <strong>{s.queued}</strong> რიგში
                    </span>
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
                    ავტომატური შემოწმება
                  </label>
                  <div className="interval-row">
                    <span>სიის შემოწმება</span>
                    <Choice
                      label="ინტერვალი"
                      value={`${s.interval_minutes} წუთი`}
                      options={[
                        '15 წუთი',
                        '30 წუთი',
                        '60 წუთი',
                        '180 წუთი',
                        '1440 წუთი',
                      ]}
                      onChange={(v) => {
                        if (v !== 'ყველა')
                          void sourceAction(s, {
                            action: 'configure',
                            intervalMinutes: parseInt(v),
                          });
                      }}
                    />
                  </div>
                  <p className="source-last">
                    არსებული ვაკანსიები: ყოველ {s.detail_interval_hours} საათში
                  </p>
                  {s.last_error && <p className="notice">{s.last_error}</p>}
                  <button
                    className="secondary-button"
                    disabled={busy || !s.enabled || !!s.requested_at}
                    onClick={() => void sourceAction(s, { action: 'run' })}
                  >
                    <RefreshCw size={16} />
                    {s.requested_at ? 'რიგშია…' : 'ახლავე შემოწმება'}
                  </button>
                </section>
              ))}
            </div>
            <p className="admin-helper">
              რიგში მოთავსებულ დავალებებს ცალკე ფონური პროცესი ასრულებს.
              დროებითი შეცდომისას შემოწმების ინტერვალი იზრდება; შენახული
              ვაკანსიები რჩება.
            </p>
          </TabsContent>
          <TabsContent value="runs">
            <div className="run-list">
              {runs.map((r) => (
                <div className="run-row" key={r.id}>
                  <strong>
                    {r.source_id === 'hr' ? 'hr.ge' : r.source_id + '.ge'}
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
                    {i.source_id === 'hr' ? 'hr.ge' : i.source_id + '.ge'}
                  </a>
                ))}
              </div>
              <div className="edit-form">
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
              <details className="raw-details">
                <summary>წყაროს ბოლო ვერსიის შედარება</summary>
                {selected.items.map((i) => (
                  <div key={i.id}>
                    <p>
                      {i.source_id} · {time(i.last_checked_at)}
                    </p>
                    {i.error && <p className="notice">{i.error}</p>}
                    <h3>{i.raw?.title}</h3>
                    <p>
                      {i.raw?.salary} · {i.raw?.city} · {i.raw?.deadline}
                    </p>
                    <p className="raw-text">{i.raw?.description}</p>
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
                შენახვა საჯარო ვერსიას არ ცვლის. გამოქვეყნება ხელით დასტურდება.
                შეტყობინებები არ იგზავნება.
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
              {confirm?.action === 'publish'
                ? 'გამოვაქვეყნოთ ეს ვერსია?'
                : confirm?.action === 'merge'
                  ? 'გავაერთიანოთ ვაკანსიები?'
                  : 'დაადასტურე ცვლილება'}
            </DialogTitle>
            <DialogDescription>
              {confirm?.action === 'publish'
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
                void act(confirm.action, {
                  itemId: confirm.itemId,
                  targetId: confirm.targetId,
                })
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
