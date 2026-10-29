'use client';
import {
  ChevronDown,
  Eye,
  FileText,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import { SwipeApplications } from './swipe-applications';
import { SkeletonRows } from '../skeleton';
import { adminTime } from '@/lib/admin-format';
import { useEffect, useRef, useState } from 'react';
import { type Cv } from '@/lib/cv';
import { CvDialog } from './cv-dialog';
import '../cv.css';
import './admin-records.css';
import './swipe-applications.css';
import { CvSummaryLine, personKey, type CvSummary } from './cv-summary';

type Resume = {
  id: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  fullName: string;
  email: string;
  phone: string;
  /** How many of our vacancies this CV's holder reached. */
  contacted: number;
  title: string;
};

type Activity = {
  jobId: string;
  title: string;
  company: string;
  kind: 'cv' | 'call' | 'apply';
  presses: number;
  lastAt: string;
};
const actionNames: Record<Activity['kind'], string> = {
  cv: 'CV-ის გაგზავნა',
  call: 'დარეკვა',
  apply: 'განაცხადი',
};
/** The CV tab: saved resumes and CVs sent through Swipe, one at a time, with one search. */
export function ResumesPanel() {
  const [view, setView] = useState<'saved' | 'swipe'>('saved');
  const [input, setInput] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setQ(input.trim()), 300);
    return () => clearTimeout(timer);
  }, [input]);
  return (
    <div className="cv-admin">
      <div className="cv-admin-bar">
        <fieldset className="admin-chips">
          <legend className="sr-only">CV-ების სია</legend>
          <button
            type="button"
            className="ds-chip"
            aria-pressed={view === 'saved'}
            onClick={() => setView('saved')}
          >
            შენახული CV-ები
          </button>
          <button
            type="button"
            className="ds-chip"
            aria-pressed={view === 'swipe'}
            onClick={() => setView('swipe')}
          >
            Swipe-ით გაგზავნილი
          </button>
        </fieldset>
        <label className="cv-admin-search">
          <Search size={16} aria-hidden="true" />
          <input
            className="ds-input"
            type="search"
            aria-label="ძებნა სახელით, ელფოსტით ან ტელეფონით"
            placeholder="სახელი, ელფოსტა ან ტელეფონი"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        </label>
      </div>
      {view === 'saved' ? (
        <SavedResumes key={q} q={q} />
      ) : (
        <SwipeApplications key={q} q={q} />
      )}
    </div>
  );
}

function SavedResumes({ q }: { q: string }) {
  const [rows, setRows] = useState<Resume[]>([]);
  const [summary, setSummary] = useState<CvSummary | null>(null);
  const [page, setPage] = useState(0);
  const [more, setMore] = useState(false);
  const [version, setVersion] = useState(0);
  const [selected, setSelected] = useState<{
    id: string;
    cv: Cv;
    activity: Activity[];
  } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const previewRequest = useRef(0);
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page) });
    if (q) params.set('q', q);
    void fetch(`/api/admin/resumes?${params}`, {
      signal: controller.signal,
      cache: 'no-store',
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw Error(data.error || 'რეზიუმეები ვერ ჩაიტვირთა');
        setRows(data.resumes);
        setMore(data.more);
        if (data.summary) setSummary(data.summary);
        setError('');
        setLoading(false);
      })
      .catch((e) => {
        if (e.name !== 'AbortError') {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [page, version, q]);
  async function open(id: string) {
    const request = ++previewRequest.current;
    setBusy(true);
    setOpening(id);
    setSelected(null);
    setError('');
    try {
      const response = await fetch(`/api/admin/resumes?id=${id}`, {
        cache: 'no-store',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw Error(data.error || 'რეზიუმე ვერ ჩაიტვირთა');
      if (request === previewRequest.current)
        setSelected({ id, cv: data.cv, activity: data.activity ?? [] });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ოპერაცია ვერ შესრულდა');
    } finally {
      setBusy(false);
      setOpening(null);
    }
  }
  async function remove(row: Resume) {
    if (
      !window.confirm(
        `წაიშალოს ${row.fullName || 'ეს'} რეზიუმე და მისი ფოტო? ამას ვეღარ დააბრუნებ.`,
      )
    )
      return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/admin/resumes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: row.id }),
      });
      if (!response.ok)
        throw Error(
          (await response.json().catch(() => ({}))).error ||
            'წაშლა ვერ შესრულდა',
        );
      if (selected?.id === row.id) setSelected(null);
      setVersion((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'წაშლა ვერ შესრულდა');
    } finally {
      setBusy(false);
    }
  }
  // One person's versions together, newest first, in the order their newest was saved.
  const people = new Map<string, Resume[]>();
  for (const row of rows) {
    const key = personKey(row.id, row.email, row.phone);
    people.set(key, [...(people.get(key) ?? []), row]);
  }
  const actions = (row: Resume) => (
    <div className="reports-actions">
      <button
        type="button"
        className="ds-btn ds-btn--secondary ds-btn--sm resume-open"
        disabled={busy}
        aria-pressed={selected?.id === row.id}
        onClick={() => void open(row.id)}
      >
        <Eye size={16} aria-hidden="true" />
        {opening === row.id ? 'იტვირთება…' : 'ნახვა'}
      </button>
      <button
        type="button"
        className="ds-btn ds-btn--ghost ds-btn--sm cv-remove"
        disabled={busy}
        title="წაშლა"
        aria-label={`წაშლა — ${row.fullName || 'უსახელო რეზიუმე'}`}
        onClick={() => void remove(row)}
      >
        <Trash2 size={16} aria-hidden="true" />
      </button>
    </div>
  );
  return (
    <section className="reports-section" aria-label="შენახული CV-ები">
      <div className="reports-heading">
        <CvSummaryLine
          summary={q ? null : summary}
          items={['შენახული CV', 'განსხვავებული ადამიანი']}
        />
        <button
          type="button"
          className="ds-btn ds-btn--secondary ds-btn--sm"
          disabled={busy || loading}
          onClick={() => {
            setLoading(true);
            setVersion((n) => n + 1);
          }}
        >
          <RefreshCw size={16} aria-hidden="true" />
          განახლება
        </button>
      </div>
      {error && (
        <div role="alert" className="records-error">
          <p>{error}</p>
          <button
            type="button"
            className="ds-btn ds-btn--secondary ds-btn--sm"
            disabled={loading}
            onClick={() => {
              setError('');
              setLoading(true);
              setVersion((n) => n + 1);
            }}
          >
            <RefreshCw size={16} aria-hidden="true" />
            ხელახლა ცდა
          </button>
        </div>
      )}
      {loading && <SkeletonRows rows={4} label="რეზიუმეები იტვირთება" />}
      {!loading && !rows.length && !error && (
        <div className="empty">
          <FileText size={20} aria-hidden="true" />
          <h3>{q ? 'ვერაფერი მოიძებნა' : 'შენახული რეზიუმე არ არის'}</h3>
          <p>
            {q
              ? 'სცადე სხვა სახელი, ელფოსტა ან ტელეფონი.'
              : 'CV-ის ბილდერში PDF-ის ღილაკზე დაჭერისას რეზიუმე აქ შეინახება.'}
          </p>
        </div>
      )}
      {!loading && !!rows.length && (
        <ul className="reports-list resumes-list">
          {[...people.values()].map(([row, ...older]) => (
            <li key={row.id} className="reports-item" data-resume={row.id}>
              <div className="reports-details">
                <p className="resumes-who">
                  <strong>{row.fullName || 'უსახელო რეზიუმე'}</strong>
                  {row.title && <span>{row.title}</span>}
                </p>
                <div className="reports-meta">
                  {(row.email || row.phone) && (
                    <span>
                      {[row.email, row.phone].filter(Boolean).join(' · ')}
                    </span>
                  )}
                  <time dateTime={row.createdAt}>
                    {adminTime(row.createdAt)}
                  </time>
                  {row.contacted > 0 && (
                    <span className="ds-badge ds-badge--violet">
                      დაუკავშირდა {row.contacted} ვაკანსიას
                    </span>
                  )}
                </div>
                {!!older.length && (
                  <details className="cv-versions">
                    <summary>
                      <ChevronDown size={14} aria-hidden="true" />
                      კიდევ {older.length} ძველი ვერსია
                    </summary>
                    <ul>
                      {older.map((old) => (
                        <li key={old.id} data-resume={old.id}>
                          <span>
                            {old.title || 'უსათაურო'} ·{' '}
                            <time dateTime={old.createdAt}>
                              {adminTime(old.createdAt)}
                            </time>
                          </span>
                          {actions(old)}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
              {actions(row)}
            </li>
          ))}
        </ul>
      )}
      <div className="admin-pagination" hidden={!page && !more && !loading}>
        <span className="admin-pagination-count">გვერდი {page + 1}</span>
        <button
          type="button"
          className="ds-btn ds-btn--secondary ds-btn--sm"
          disabled={!page || loading || busy}
          onClick={() => {
            setLoading(true);
            setPage(page - 1);
          }}
        >
          წინა
        </button>
        <button
          type="button"
          className="ds-btn ds-btn--secondary ds-btn--sm"
          disabled={!more || loading || busy}
          onClick={() => {
            setLoading(true);
            setPage(page + 1);
          }}
        >
          შემდეგი
        </button>
      </div>
      <CvDialog
        open={!!opening || !!selected}
        onClose={() => {
          previewRequest.current++;
          setSelected(null);
          setOpening(null);
        }}
        cv={selected?.cv}
      >
        {selected && (
          <>
            <section className="resume-activity" aria-label="რა გააკეთა">
              <h3>რა გააკეთა ჩვენს ვაკანსიებზე</h3>
              {!selected.activity.length ? (
                <p>
                  ჯერ არაფერი: ამ CV-ით JOBX-ზე დამატებულ ვაკანსიას არ
                  დაკავშირებია.
                </p>
              ) : (
                <ul>
                  {selected.activity.map((a) => (
                    <li key={a.jobId + a.kind}>
                      <strong>{actionNames[a.kind]}</strong>
                      {a.presses > 1 && <span> ×{a.presses}</span>}
                      <span>
                        {a.title || 'ვაკანსია'}
                        {a.company && ` · ${a.company}`}
                      </span>
                      <time dateTime={a.lastAt}>{adminTime(a.lastAt)}</time>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </CvDialog>
    </section>
  );
}
