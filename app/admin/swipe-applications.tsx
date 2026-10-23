'use client';
import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { ApplicationCvLinks } from './application-cv-links';
import { adminTime } from '@/lib/admin-format';
import { vacancyPath } from '@/lib/vacancy-navigation';
import { SkeletonRows } from '../skeleton';

type Application = {
  id: string;
  createdAt: string;
  name: string;
  email: string;
  phone: string;
  jobId: string;
  title: string;
  recipient: string;
  status: 'sending' | 'sent' | 'failed';
  cvKind: 'upload' | 'jobx';
  hasFile: boolean;
  resumeId: string | null;
};
const statusNames = {
  sending: 'იგზავნება',
  sent: 'გაგზავნილია',
  failed: 'ვერ გაიგზავნა',
};
export function SwipeApplications() {
  const [rows, setRows] = useState<Application[]>([]);
  const [page, setPage] = useState(0);
  const [more, setMore] = useState(false);
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/admin/swipe?page=${page}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok)
          throw Error(data.error || 'განაცხადები ვერ ჩაიტვირთა');
        setRows(data.applications);
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
  return (
    <section
      className="reports-section swipe-applications"
      aria-label="Swipe განაცხადები"
    >
      <div className="reports-heading">
        <h2>Swipe განაცხადები</h2>
        <button
          className="ds-btn ds-btn--secondary ds-btn--sm"
          disabled={loading}
          onClick={() => {
            setLoading(true);
            setVersion((v) => v + 1);
          }}
        >
          <RefreshCw size={16} aria-hidden="true" />
          განახლება
        </button>
      </div>
      {error && (
        <p role="alert" className="records-error">
          {error}
        </p>
      )}
      {loading ? (
        <SkeletonRows rows={3} label="განაცხადები იტვირთება" />
      ) : !error && !rows.length ? (
        <p className="empty">Swipe განაცხადები ჯერ არ არის.</p>
      ) : (
        !error && (
          <ul className="reports-list resumes-list ds-appear-list">
            {rows.map((row) => (
              <li
                key={row.id}
                className="reports-item"
                data-status={row.status}
              >
                <div className="reports-details">
                  <p className="resumes-who">
                    <strong>{row.name}</strong>
                    <span>
                      {row.email}
                      {row.phone && ` · ${row.phone}`}
                    </span>
                  </p>
                  <a
                    href={vacancyPath({ id: row.jobId, title: row.title })}
                    target="_blank"
                    rel="noopener"
                  >
                    {row.title}
                  </a>
                  <div className="reports-meta">
                    <time dateTime={row.createdAt}>
                      {adminTime(row.createdAt)}
                    </time>
                    <span>მიმღები: {row.recipient}</span>
                    <span
                      className="application-status"
                      data-status={row.status}
                    >
                      {statusNames[row.status]}
                    </span>
                    <span>
                      {row.cvKind === 'upload' ? 'ატვირთული PDF' : 'JOBX CV'}
                    </span>
                  </div>
                </div>
                <div className="reports-actions">
                  <ApplicationCvLinks application={row} />
                </div>
              </li>
            ))}
          </ul>
        )
      )}
      <div className="admin-pagination" hidden={!page && !more}>
        <span className="admin-pagination-count">გვერდი {page + 1}</span>
        <button
          className="ds-btn ds-btn--secondary ds-btn--sm"
          disabled={!page || loading}
          onClick={() => {
            setLoading(true);
            setPage((p) => p - 1);
          }}
        >
          წინა
        </button>
        <button
          className="ds-btn ds-btn--secondary ds-btn--sm"
          disabled={!more || loading}
          onClick={() => {
            setLoading(true);
            setPage((p) => p + 1);
          }}
        >
          შემდეგი
        </button>
      </div>
    </section>
  );
}
