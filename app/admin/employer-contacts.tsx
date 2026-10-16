'use client';
import { useEffect, useState } from 'react';
import { Mail, Phone, RefreshCw } from 'lucide-react';
import { adminTime } from '@/lib/admin-format';
import {
  publicationEmailStatuses,
  type EmployerContact,
} from '@/lib/employer-contacts';
import './employer-contacts.css';

export function EmployerContacts({
  onReview,
}: {
  onReview: (id: string) => void;
}) {
  const [employers, setEmployers] = useState<EmployerContact[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/admin/employer-contacts', {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw Error(data.error || 'სია ვერ ჩაიტვირთა');
        setEmployers(data.employers);
        setEmailEnabled(data.emailEnabled);
        setError('');
        setReady(true);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [revision]);
  const needle = query.trim().toLowerCase();
  const visible = employers.filter(
    (e) =>
      [e.company, ...e.emails, ...e.phones].some((v) =>
        v.toLowerCase().includes(needle),
      ) &&
      (filter !== 'active' || e.jobs.some((j) => j.active)) &&
      (filter !== 'uncontacted' || !e.lastContactedAt) &&
      (filter !== 'failed' || e.jobs.some((j) => j.emailStatus === 'failed')),
  );
  return (
    <div className="customer-list">
      <div className="customer-toolbar">
        <input
          aria-label="დამსაქმებლის ძებნა"
          type="search"
          placeholder="კომპანია, ელფოსტა ან ტელეფონი"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          aria-label="დამსაქმებლების ფილტრი"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">ყველა დამსაქმებელი</option>
          <option value="active">აქტიური ვაკანსიით</option>
          <option value="uncontacted">ჯერ არ დავკავშირებივართ</option>
          <option value="failed">წერილი ვერ გაიგზავნა</option>
        </select>
        <button
          className="ds-btn ds-btn--secondary"
          onClick={() => setRevision((v) => v + 1)}
        >
          <RefreshCw size={16} />
          განახლება
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      {ready && !emailEnabled && (
        <p className="notice" role="alert">
          ელფოსტის ავტომატური გაგზავნა გამორთულია. წერილები რიგში შეინახება,
          სანამ გაგზავნა ჩაირთვება.
        </p>
      )}
      {!ready && !error && <p>იტვირთება…</p>}
      {ready && (
        <p className="admin-helper">
          {visible.length} დამსაქმებელი ·{' '}
          {employers.reduce((n, e) => n + e.jobs.length, 0)} განცხადება
        </p>
      )}
      {ready && !visible.length && <p>დამსაქმებელი ვერ მოიძებნა.</p>}
      {visible.map((employer) => (
        <EmployerCard
          key={`${revision}:${employer.key}`}
          employer={employer}
          onReview={onReview}
          onSaved={(data) =>
            setEmployers((rows) =>
              rows.map((r) => (r.key === employer.key ? { ...r, ...data } : r)),
            )
          }
        />
      ))}
    </div>
  );
}
function EmployerCard({
  employer,
  onReview,
  onSaved,
}: {
  employer: EmployerContact;
  onReview: (id: string) => void;
  onSaved: (
    data: Pick<EmployerContact, 'notes' | 'version' | 'lastContactedAt'>,
  ) => void;
}) {
  const [notes, setNotes] = useState(employer.notes);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function save(contacted: boolean) {
    setBusy(true);
    setMessage('');
    try {
      const r = await fetch('/api/admin/employer-contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: employer.key,
          version: employer.version,
          notes,
          contacted,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error || 'შენახვა ვერ მოხერხდა');
      onSaved(data);
      setNotes(data.notes);
      setMessage(contacted ? 'დაკავშირების თარიღი შენახულია.' : 'შენახულია.');
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="customer-card">
      <summary>
        <strong>{employer.company}</strong>
        <span>
          {employer.jobs.length} განცხადება ·{' '}
          {employer.jobs.filter((j) => j.active).length} აქტიური
        </span>
      </summary>
      <div className="customer-content">
        <div className="customer-contacts">
          {employer.emails.map((email) => (
            <a key={email} href={`mailto:${email}`}>
              <Mail size={16} />
              {email}
            </a>
          ))}
          {employer.phones.map((phone) => (
            <a key={phone} href={`tel:${phone}`}>
              <Phone size={16} />
              {phone}
            </a>
          ))}
          {!employer.emails.length && <p>ელფოსტა არ არის მითითებული.</p>}
        </div>
        <p>
          ბოლო დაკავშირება:{' '}
          {employer.lastContactedAt
            ? adminTime(employer.lastContactedAt)
            : 'ჯერ არ არის მონიშნული'}
        </p>
        <label>
          შენიშვნა
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={4000}
            rows={3}
            disabled={busy}
          />
        </label>
        <div className="customer-actions">
          <button
            className="ds-btn ds-btn--secondary"
            disabled={busy || notes === employer.notes}
            onClick={() => void save(false)}
          >
            შენახვა
          </button>
          <button
            className="ds-btn ds-btn--secondary"
            disabled={busy}
            onClick={() => void save(true)}
          >
            დღეს დავუკავშირდი
          </button>
        </div>
        {message && <output>{message}</output>}
        <h3>ვაკანსიების ისტორია</h3>
        <ul className="customer-jobs">
          {employer.jobs.map((j) => (
            <li key={j.id}>
              <button
                className="ds-btn ds-btn--ghost"
                onClick={() => onReview(j.id)}
              >
                {j.title}
              </button>
              <small>
                {adminTime(j.createdAt)} ·{' '}
                {j.active
                  ? 'აქტიური'
                  : j.status === 'pending'
                    ? 'შესამოწმებელი'
                    : 'დახურული'}
              </small>
              <span data-failed={j.emailStatus === 'failed'}>
                გამოქვეყნების წერილი:{' '}
                {j.emailStatus
                  ? publicationEmailStatuses[j.emailStatus] || j.emailStatus
                  : 'არ გაგზავნილა'}
                {j.emailSentAt ? ` · ${adminTime(j.emailSentAt)}` : ''}
              </span>
              {j.notificationEmail && (
                <small>მიმღები: {j.notificationEmail}</small>
              )}
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
