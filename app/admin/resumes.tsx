'use client';
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
        const data = await response.json();
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
      const data = await response.json();
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
        throw Error((await response.json()).error || 'წაშლა ვერ შესრულდა');
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
        <button
          type="button"
          className="secondary-button"
          disabled={busy || loading}
          onClick={() => {
            setLoading(true);
            setVersion((n) => n + 1);
          }}
        >
          განახლება
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      {loading && <p>რეზიუმეები იტვირთება…</p>}
      {!loading && !rows.length && <p>შენახული რეზიუმეები არ არის.</p>}
      <ul className="reports-list">
        {rows.map((row) => (
          <li key={row.id}>
            <p>
              {adminTime(row.createdAt)} ·{' '}
              {row.language === 'ka' ? 'ქართული' : 'ინგლისური'} · {row.template}{' '}
              · სისრულე: {row.completeness}%
            </p>
            <button
              type="button"
              className="secondary-button"
              disabled={busy}
              onClick={() => void open(row.id)}
            >
              ნახვა
            </button>{' '}
            <button
              type="button"
              className="secondary-button"
              disabled={busy}
              onClick={() => void remove(row.id)}
            >
              წაშლა
            </button>
          </li>
        ))}
      </ul>
      <div className="reports-heading">
        <button
          type="button"
          className="secondary-button"
          disabled={!page || loading || busy}
          onClick={() => {
            setLoading(true);
            setPage(page - 1);
          }}
        >
          წინა
        </button>
        <span>გვერდი {page + 1}</span>
        <button
          type="button"
          className="secondary-button"
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
        <div>
          <button
            type="button"
            className="secondary-button"
            onClick={() => setSelected(null)}
          >
            დახურვა
          </button>
          <div style={{ overflowX: 'auto' }}>
            <CvSheet cv={selected.cv} />
          </div>
        </div>
      )}
    </section>
  );
}
