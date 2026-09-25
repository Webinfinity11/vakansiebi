'use client';
import { Eye, FileText, RefreshCw, Trash2, X } from 'lucide-react';
import { SkeletonRows } from '../skeleton';
import { adminTime } from '@/lib/admin-format';
import { useEffect, useState } from 'react';
import type { Cv } from '@/lib/cv';
import { CvSheet } from '../cv/cv-builder';
import '../cv.css';

type Resume = {
  id: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  language: string;
  template: string;
  completeness: number;
};

export function ResumesPanel() {
  const [rows, setRows] = useState<Resume[]>([]);
  const [page, setPage] = useState(0);
  const [more, setMore] = useState(false);
  const [version, setVersion] = useState(0);
  const [selected, setSelected] = useState<{ id: string; cv: Cv } | null>(null);
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
      setSelected({ id, cv: data.cv });
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
        <p role="alert" className="notice">
          {error}
        </p>
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
                <div className="reports-meta">
                  <time dateTime={row.createdAt}>
                    {adminTime(row.createdAt)}
                  </time>
                  <span className="ds-badge">
                    {row.language === 'ka' ? 'ქართული' : 'ინგლისური'}
                  </span>
                  <span>{row.template}</span>
                  <span className="resumes-complete">
                    სისრულე: {row.completeness}%
                  </span>
                </div>
              </div>
              <div className="reports-actions">
                <button
                  type="button"
                  className="ds-btn ds-btn--ghost ds-btn--sm"
                  disabled={busy}
                  aria-pressed={selected?.id === row.id}
                  onClick={() => void open(row.id)}
                >
                  <Eye size={16} aria-hidden="true" />
                  ნახვა
                </button>
                <button
                  type="button"
                  className="ds-btn ds-btn--danger ds-btn--sm"
                  disabled={busy}
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
          <button
            type="button"
            className="ds-btn ds-btn--secondary ds-btn--sm"
            onClick={() => setSelected(null)}
          >
            <X size={16} aria-hidden="true" />
            დახურვა
          </button>
          <div className="resumes-sheet">
            <CvSheet cv={selected.cv} />
          </div>
        </div>
      )}
    </section>
  );
}
