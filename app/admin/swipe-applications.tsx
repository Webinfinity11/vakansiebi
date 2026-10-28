'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, Eye, RefreshCw, Send } from 'lucide-react';
import { adminTime } from '@/lib/admin-format';
import { vacancyPath } from '@/lib/vacancy-navigation';
import { SkeletonRows } from '../skeleton';
import { CvSummaryLine, type CvSummary } from './cv-summary';

type Application = {
  id: string;
  createdAt: string;
  jobId: string;
  title: string;
  recipient: string;
  status: 'sending' | 'sent' | 'failed';
  cvKind: 'upload' | 'jobx';
  hasFile: boolean;
  resumeId: string | null;
};
type Candidate = {
  key: string;
  name: string;
  email: string;
  phone: string;
  sent: number;
  failed: number;
  lastAt: string;
  applications: Application[];
};
const statusNames = {
  sending: 'იგზავნება',
  sent: 'გაგზავნილია',
  failed: 'ვერ გაიგზავნა',
};

/** One link to the CV that went out; the browser's own viewer saves it as a PDF. */
function CvLink({ application }: { application: Application }) {
  if (
    !application.hasFile &&
    !(application.cvKind === 'jobx' && application.resumeId)
  )
    return <span className="application-cv-missing">CV-ის ასლი არ არის</span>;
  return (
    <a
      className="ds-btn ds-btn--secondary ds-btn--sm"
      href={`/api/admin/swipe/download?id=${application.id}&view=1`}
      target="_blank"
      rel="noopener noreferrer"
    >
      <Eye size={16} aria-hidden="true" />
      CV
    </a>
  );
}

/** Which vacancy, to whom and when; the status only when it is not plainly sent. */
function SendLine({ application: a }: { application: Application }) {
  return (
    <span className="cv-send">
      <a
        href={vacancyPath({ id: a.jobId, title: a.title })}
        target="_blank"
        rel="noopener"
      >
        {a.title}
      </a>
      <small>
        {a.recipient} ·{' '}
        <time dateTime={a.createdAt}>{adminTime(a.createdAt)}</time>
        {a.status !== 'sent' && (
          <>
            {' · '}
            <span className="application-status" data-status={a.status}>
              {statusNames[a.status]}
            </span>
          </>
        )}
      </small>
    </span>
  );
}

export function SwipeApplications({ q = '' }: { q?: string }) {
  const [rows, setRows] = useState<Candidate[]>([]);
  const [summary, setSummary] = useState<CvSummary | null>(null);
  const [page, setPage] = useState(0);
  const [more, setMore] = useState(false);
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page) });
    if (q) params.set('q', q);
    void fetch(`/api/admin/swipe?${params}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw Error(data.error || 'გაგზავნები ვერ ჩაიტვირთა');
        setRows(data.candidates);
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
  return (
    <section
      className="reports-section swipe-applications"
      aria-label="Swipe-ით გაგზავნილი CV-ები"
    >
      <div className="reports-heading">
        <CvSummaryLine
          summary={q ? null : summary}
          items={['გაგზავნილი CV', 'კანდიდატი']}
        />
        <button
          type="button"
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
        <SkeletonRows rows={3} label="გაგზავნები იტვირთება" />
      ) : !error && !rows.length ? (
        <p className="empty">
          {q ? 'ვერაფერი მოიძებნა.' : 'Swipe-ით ჯერ არავის გაუგზავნია CV.'}
        </p>
      ) : (
        !error && (
          <ul className="reports-list resumes-list">
            {rows.map((row) => (
              <li
                key={row.key}
                className="reports-item"
                data-status={row.failed ? 'failed' : 'sent'}
              >
                <div className="reports-details">
                  <p className="resumes-who">
                    <strong>{row.name || 'უსახელო'}</strong>
                    <span>
                      {[row.email, row.phone].filter(Boolean).join(' · ')}
                    </span>
                  </p>
                  <div className="reports-meta">
                    <span className="ds-badge">
                      <Send size={14} aria-hidden="true" />
                      გაგზავნა: {row.sent}
                    </span>
                    {row.failed > 0 && (
                      <span className="application-status" data-status="failed">
                        ვერ გაიგზავნა: {row.failed}
                      </span>
                    )}
                    {row.sent > 1 && (
                      <span>
                        ბოლოს{' '}
                        <time dateTime={row.lastAt}>
                          {adminTime(row.lastAt)}
                        </time>
                      </span>
                    )}
                  </div>
                  {row.sent === 1 ? (
                    <SendLine application={row.applications[0]} />
                  ) : (
                    <details className="cv-versions">
                      <summary>
                        <ChevronDown size={14} aria-hidden="true" />
                        სად გაიგზავნა ({row.sent})
                      </summary>
                      <ul>
                        {row.applications.map((a) => (
                          <li key={a.id}>
                            <SendLine application={a} />
                            <CvLink application={a} />
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
                <div className="reports-actions">
                  <CvLink application={row.applications[0]} />
                </div>
              </li>
            ))}
          </ul>
        )
      )}
      <div className="admin-pagination" hidden={!page && !more}>
        <span className="admin-pagination-count">გვერდი {page + 1}</span>
        <button
          type="button"
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
          type="button"
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
