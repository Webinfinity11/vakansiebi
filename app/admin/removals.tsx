'use client';
import { useEffect, useState, type SubmitEvent } from 'react';
import { adminTime } from '@/lib/admin-format';
import { SkeletonRows } from '../skeleton';
import './removals.css';

type Removed = {
  id: string;
  removedAt: string;
  title: string;
  company: string;
  url: string;
  reason: string;
  active: boolean;
};
type Rule = {
  id: string;
  email: string | null;
  companyNames: string[];
  reason: string;
};
type Request = {
  id: string;
  sender: string;
  excerpt: string;
  companyNames: string[];
  status: string;
  note: string;
  confirmationStatus: string | null;
  createdAt: string;
};
type Data = {
  vacancies: Removed[];
  rules: Rule[];
  requests: Request[];
  more: boolean;
  total: number;
};
export function RemovalsPanel() {
  const [data, setData] = useState<Data | null>(null),
    [page, setPage] = useState(0),
    [version, setVersion] = useState(0);
  const [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  const [email, setEmail] = useState(''),
    [names, setNames] = useState(''),
    [reason, setReason] = useState('დამსაქმებლის მოთხოვნით');
  useEffect(() => {
    const abort = new AbortController();
    fetch(`/api/admin/removals?page=${page}`, {
      cache: 'no-store',
      signal: abort.signal,
    })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw Error(body.error || 'სია ვერ ჩაიტვირთა');
        return body;
      })
      .then((body) => {
        setData(body);
        setError('');
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e.message);
      });
    return () => abort.abort();
  }, [page, version]);
  async function act(action: string, body: Record<string, unknown>) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const r = await fetch('/api/admin/removals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...body }),
      });
      const result = await r.json();
      if (!r.ok) throw Error(result.error || 'მოქმედება ვერ შესრულდა');
      setMessage(
        action === 'release'
          ? 'ბლოკი მოიხსნა. ძველი ვაკანსიები ავტომატურად არ დაბრუნდება.'
          : action === 'ignore'
            ? 'მოთხოვნა გამოტოვებულია.'
            : 'ამოღება შესრულებულია; მომავალი განთავსება დაბლოკილია.',
      );
      setVersion((v) => v + 1);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'მოქმედება ვერ შესრულდა');
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function submit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (
      await act('block', {
        ...(email.trim() ? { email: email.trim() } : {}),
        companyNames: names
          .split(/[,\n]/)
          .map((v) => v.trim())
          .filter(Boolean),
        reason,
      })
    ) {
      setEmail('');
      setNames('');
    }
  }
  return (
    <div className="admin-removals">
      <p className="removal-intro">
        ამოღებული კომპანიის ვაკანსიები აღარ გამოჩნდება საიტზე და ხელახალი
        იმპორტიც დაბლოკილია.
      </p>
      {error && (
        <p role="alert" className="records-error">
          {error}
        </p>
      )}
      {message && <output>{message}</output>}
      <details className="removal-form">
        <summary>კომპანიის ბლოკირება და ვაკანსიების ამოღება</summary>
        <form onSubmit={submit}>
          <label>
            კომპანიის საკონტაქტო მეილი
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="hr@company.ge"
            />
          </label>
          <label>
            კომპანიის ზუსტი სახელები
            <textarea
              value={names}
              onChange={(e) => setNames(e.target.value)}
              rows={2}
              placeholder="თითო სახელი ახალ ხაზზე"
            />
          </label>
          <label>
            მიზეზი
            <input
              required
              minLength={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <p>
            დაიბლოკება ამ მეილთან ან სახელთან დაკავშირებული ვაკანსიები. ცნობილ
            დამსაქმებელს დადასტურებაც გაეგზავნება.
          </p>
          <button
            className="ds-btn ds-btn--primary"
            disabled={busy || (!email.trim() && !names.trim())}
          >
            ბლოკირება და ამოღება
          </button>
        </form>
      </details>
      {!data && !error ? (
        <SkeletonRows rows={3} label="ამოღებული ვაკანსიები იტვირთება" />
      ) : (
        data && (
          <>
            <section className="reports-section">
              <div className="reports-heading">
                <h2>ამოღების მოთხოვნები</h2>
                <button
                  className="ds-btn ds-btn--secondary ds-btn--sm"
                  disabled={busy}
                  onClick={() => setVersion((v) => v + 1)}
                >
                  განახლება
                </button>
              </div>
              {!data.requests.length ? (
                <p>მოთხოვნები ჯერ არ არის.</p>
              ) : (
                <ul className="reports-list">
                  {data.requests.map((r) => (
                    <li
                      key={r.id}
                      className="reports-item"
                      data-review={r.status === 'review' || undefined}
                    >
                      <div className="reports-details">
                        <strong>{r.sender}</strong>
                        <p className="removal-excerpt">{r.excerpt}</p>
                        <div className="reports-meta">
                          <span>
                            {r.status === 'review'
                              ? 'შესამოწმებელია'
                              : 'ამოღებულია'}
                          </span>
                          <span>
                            {r.confirmationStatus === 'sent'
                              ? 'დამადასტურებელი მეილი გაგზავნილია'
                              : r.confirmationStatus === 'pending' ||
                                  r.confirmationStatus === 'sending'
                                ? 'დამადასტურებელი მეილი რიგშია'
                                : r.confirmationStatus === 'failed'
                                  ? 'მეილის გაგზავნა შესამოწმებელია'
                                  : r.note}
                          </span>
                          <time dateTime={r.createdAt}>
                            {adminTime(r.createdAt)}
                          </time>
                        </div>
                      </div>
                      {r.status === 'review' && (
                        <div className="reports-actions">
                          <button
                            className="ds-btn ds-btn--primary ds-btn--sm"
                            disabled={busy || !r.companyNames.length}
                            onClick={() => void act('approve', { id: r.id })}
                          >
                            დადასტურება და ამოღება
                          </button>
                          <button
                            className="ds-btn ds-btn--secondary ds-btn--sm"
                            disabled={busy}
                            onClick={() => void act('ignore', { id: r.id })}
                          >
                            გამოტოვება
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="reports-section">
              <h2>დაბლოკილი კომპანიები · {data.rules.length}</h2>
              <ul className="reports-list">
                {data.rules.map((r) => (
                  <li key={r.id} className="reports-item">
                    <div className="reports-details">
                      <strong>{r.companyNames.join(' · ') || r.email}</strong>
                      <p>{r.email}</p>
                      <span>{r.reason}</span>
                    </div>
                    <button
                      className="ds-btn ds-btn--secondary ds-btn--sm"
                      disabled={busy}
                      onClick={() => {
                        if (
                          window.confirm(
                            'მოიხსნას ბლოკირება? ძველი ვაკანსიები ავტომატურად არ დაბრუნდება.',
                          )
                        )
                          void act('release', { id: r.id });
                      }}
                    >
                      ბლოკის მოხსნა
                    </button>
                  </li>
                ))}
              </ul>
            </section>
            <section className="reports-section">
              <h2>ამოღებული ვაკანსიები · {data.total}</h2>
              {!data.vacancies.length ? (
                <p>ამოღებული ვაკანსიები ჯერ არ არის.</p>
              ) : (
                <ul className="reports-list">
                  {data.vacancies.map((r) => (
                    <li key={r.id} className="reports-item removed-vacancy">
                      <div className="reports-details">
                        <strong>{r.title}</strong>
                        <p>{r.company}</p>
                        <div className="reports-meta">
                          <span>
                            {r.active
                              ? 'ამოღებულია — განთავსება დაბლოკილია'
                              : 'ამოღებულია — ბლოკი მოხსნილია'}
                          </span>
                          <span>{r.reason}</span>
                          <time dateTime={r.removedAt}>
                            {adminTime(r.removedAt)}
                          </time>
                        </div>
                      </div>
                      {r.url && (
                        <a
                          className="ds-btn ds-btn--secondary ds-btn--sm"
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          პირველწყარო
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {(page > 0 || data.more) && (
                <div className="admin-pagination">
                  <span>გვერდი {page + 1}</span>
                  <button
                    className="ds-btn ds-btn--secondary ds-btn--sm"
                    disabled={!page || busy}
                    onClick={() => setPage((v) => v - 1)}
                  >
                    წინა
                  </button>
                  <button
                    className="ds-btn ds-btn--secondary ds-btn--sm"
                    disabled={!data.more || busy}
                    onClick={() => setPage((v) => v + 1)}
                  >
                    შემდეგი
                  </button>
                </div>
              )}
            </section>
          </>
        )
      )}
    </div>
  );
}
