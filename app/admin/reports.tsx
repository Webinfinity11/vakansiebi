'use client';
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
        const body = await response.json();
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
      const body = await response.json();
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
        <button
          type="button"
          className="secondary-button reports-action"
          disabled={!!busy}
          onClick={() => setVersion((value) => value + 1)}
        >
          განახლება
        </button>
      </div>
      {error && (
        <p role="alert" className="reports-error">
          {error}
        </p>
      )}
      <output className="reports-status">{message}</output>
      {!reports && !error && <p>შეტყობინებები იტვირთება…</p>}
      {reports?.length === 0 && <p>ღია შეტყობინებები არ არის.</p>}
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
                  <strong>{reasons[report.reason]}</strong>
                  <time dateTime={report.created_at}>
                    {new Date(report.created_at).toLocaleString('ka-GE', {
                      timeZone: 'Asia/Tbilisi',
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </time>
                </div>
                {report.note && <p className="reports-note">{report.note}</p>}
                <button
                  type="button"
                  className="secondary-button reports-action"
                  disabled={!!busy}
                  onClick={() => onOpenJob(report.job_id)}
                >
                  რედაქტორში გახსნა
                </button>
              </div>
              <button
                type="button"
                className="secondary-button reports-action"
                disabled={!!busy}
                onClick={() => void resolve(report.id)}
              >
                {busy === report.id ? 'ინახება…' : 'გადაწყვეტილია'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
