'use client';
import { Download, Eye, FileText, RefreshCw, Trash2, X } from 'lucide-react';
import { SkeletonRows } from '../skeleton';
import { adminTime } from '@/lib/admin-format';
import { useEffect, useState } from 'react';
import { cvText, downloadCv, type Cv, type CvTemplate } from '@/lib/cv';
import { CvSheet } from '../cv/cv-builder';
import '../cv.css';
import './admin-records.css';

type Resume = {
  id: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  fullName: string;
  /** How many of our vacancies this CV's holder reached. */
  contacted: number;
  title: string;
  language: string;
  template: string;
  completeness: number;
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

export function ResumesPanel() {
  const [rows, setRows] = useState<Resume[]>([]);
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
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/admin/resumes?page=${page}`, {
      signal: controller.signal,
      cache: 'no-store',
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw Error(data.error || 'რეზიუმეები ვერ ჩაიტვირთა');
        setRows(data.resumes);
        setMore(data.more);
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
  }, [page, version]);
  async function open(id: string) {
    setBusy(true);
    setSelected(null);
    setError('');
    try {
      const response = await fetch(`/api/admin/resumes?id=${id}`, {
        cache: 'no-store',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw Error(data.error || 'რეზიუმე ვერ ჩაიტვირთა');
      setSelected({ id, cv: data.cv, activity: data.activity ?? [] });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ოპერაცია ვერ შესრულდა');
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: string) {
    if (!window.confirm('წაიშალოს შენახული რეზიუმე და ფოტო?')) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/admin/resumes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!response.ok)
        throw Error(
          (await response.json().catch(() => ({}))).error ||
            'წაშლა ვერ შესრულდა',
        );
      if (selected?.id === id) setSelected(null);
      setVersion((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'წაშლა ვერ შესრულდა');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="reports-section" aria-label="შენახული რეზიუმეები">
      <div className="reports-heading">
        <h2>შენახული რეზიუმეები</h2>
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
          <h3>შენახული რეზიუმე არ არის</h3>
          <p>CV-ის ბილდერში PDF-ის ღილაკზე დაჭერისას რეზიუმე აქ შეინახება.</p>
        </div>
      )}
      {!loading && !!rows.length && (
        <ul className="reports-list resumes-list ds-appear-list">
          {rows.map((row) => (
            <li key={row.id} className="reports-item">
              <div className="reports-details">
                <p className="resumes-who">
                  <strong>{row.fullName || 'უსახელო რეზიუმე'}</strong>
                  {row.title && <span>{row.title}</span>}
                </p>
                <div className="reports-meta">
                  <time dateTime={row.createdAt}>
                    {adminTime(row.createdAt)}
                  </time>
                  <span className="ds-badge">
                    {row.language === 'ka' ? 'ქართული' : 'ინგლისური'}
                  </span>
                  <span>
                    შაბლონი:{' '}
                    {cvText.ka.templates[row.template as CvTemplate]?.name ??
                      row.template}
                  </span>
                  <span className="resumes-complete">
                    სისრულე: {row.completeness}%
                  </span>
                  {row.contacted > 0 && (
                    <span className="ds-badge ds-badge--violet">
                      დაუკავშირდა {row.contacted} ვაკანსიას
                    </span>
                  )}
                </div>
              </div>
              <div className="reports-actions">
                <button
                  type="button"
                  className="ds-btn ds-btn--secondary ds-btn--sm"
                  disabled={busy}
                  aria-pressed={selected?.id === row.id}
                  onClick={() => void open(row.id)}
                >
                  <Eye size={16} aria-hidden="true" />
                  ნახვა
                </button>
                <button
                  type="button"
                  className="ds-btn ds-btn--ghost ds-btn--sm records-danger"
                  disabled={busy}
                  aria-label={`წაშლა — ${row.fullName || 'უსახელო რეზიუმე'}`}
                  onClick={() => void remove(row.id)}
                >
                  <Trash2 size={16} aria-hidden="true" />
                  წაშლა
                </button>
              </div>
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
      {selected && (
        <div className="resumes-preview ds-appear">
          <div className="resumes-preview-actions">
            <button
              type="button"
              className="ds-btn ds-btn--primary ds-btn--sm"
              onClick={() => downloadCv(selected.cv.fullName)}
            >
              <Download size={16} aria-hidden="true" />
              PDF-ად ჩამოტვირთვა
            </button>
            <button
              type="button"
              className="ds-btn ds-btn--secondary ds-btn--sm"
              onClick={() => setSelected(null)}
            >
              <X size={16} aria-hidden="true" />
              დახურვა
            </button>
          </div>
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
          <div className="resumes-sheet">
            <CvSheet cv={selected.cv} />
          </div>
        </div>
      )}
    </section>
  );
}
