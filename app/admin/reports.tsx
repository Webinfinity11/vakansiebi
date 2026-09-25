'use client';
import { Check, CheckCircle2, PencilLine, RefreshCw } from 'lucide-react';
import { SkeletonRows } from '../skeleton';
import { adminTime } from '@/lib/admin-format';
import { useEffect, useState } from 'react';

const reasons = {
  expired: 'ვადაგასულია',
  wrong: 'არასწორი ინფორმაცია',
  duplicate: 'დუბლიკატია',
  other: 'სხვა',
};
type Report = {
  id: string;
  job_id: string;
  reason: keyof typeof reasons;
  note: string | null;
  title: string;
  url: string;
  created_at: string;
};

export function ReportsSection({
  onChange,
  onOpenJob,
}: {
  onChange?: () => void;
  onOpenJob: (jobId: string) => void;
}) {
  const [reports, setReports] = useState<Report[] | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/admin/reports?open=1', {
      signal: controller.signal,
      cache: 'no-store',
    })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok)
          throw Error(body.error || 'შეტყობინებები ვერ ჩაიტვირთა');
        setReports(body.reports);
        setError('');
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e.message);
      });
    return () => controller.abort();
  }, [version]);

  async function resolve(id: string) {
    setBusy(id);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/admin/reports', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, resolved: true }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok)
        throw Error(body.error || 'ცვლილება ვერ შეინახა. სცადე ხელახლა.');
      setReports((items) => items?.filter((item) => item.id !== id) ?? null);
      onChange?.();
      setMessage('შეტყობინება მონიშნულია გადაწყვეტილად.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ცვლილება ვერ შეინახა.');
    } finally {
      setBusy('');
    }
  }

  return (
    <section className="reports-section" aria-label="ღია შეტყობინებები">
      <div className="reports-heading">
        <h2>
          ღია შეტყობინებები
          {!!reports?.length && <b>{reports.length}</b>}
        </h2>
        <button
          type="button"
          className="ds-btn ds-btn--secondary ds-btn--sm"
          disabled={!!busy}
          onClick={() => setVersion((value) => value + 1)}
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
      <output className="reports-status">{message}</output>
      {!reports && !error && (
        <SkeletonRows rows={3} label="შეტყობინებები იტვირთება" />
      )}
      {reports?.length === 0 && (
        <div className="empty">
          <CheckCircle2 size={20} aria-hidden="true" />
          <h3>ღია შეტყობინება არ არის</h3>
          <p>როცა ვინმე ვაკანსიაზე პრობლემას მონიშნავს, აქ გამოჩნდება.</p>
        </div>
      )}
      {!!reports?.length && (
        <ul className="reports-list">
          {reports.map((report) => (
            <li key={report.id} className="reports-item">
              <div className="reports-details">
                <a
                  className="reports-link"
                  href={report.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {report.title}
                </a>
                <div className="reports-meta">
                  <span className="ds-badge ds-badge--warning">
                    {reasons[report.reason]}
                  </span>
                  <time dateTime={report.created_at}>
                    {adminTime(report.created_at)}
                  </time>
                </div>
                {report.note && <p className="reports-note">{report.note}</p>}
              </div>
              <div className="reports-actions">
                <button
                  type="button"
                  className="ds-btn ds-btn--ghost ds-btn--sm"
                  disabled={!!busy}
                  onClick={() => onOpenJob(report.job_id)}
                >
                  <PencilLine size={16} aria-hidden="true" />
                  რედაქტორში გახსნა
                </button>
                <button
                  type="button"
                  className="ds-btn ds-btn--secondary ds-btn--sm"
                  disabled={!!busy}
                  onClick={() => void resolve(report.id)}
                >
                  {busy === report.id ? (
                    <span className="ds-spinner" aria-hidden="true" />
                  ) : (
                    <Check size={16} aria-hidden="true" />
                  )}
                  {busy === report.id ? 'ინახება…' : 'გადაწყვეტილია'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
