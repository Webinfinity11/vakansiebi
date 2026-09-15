'use client';
import { useEffect, useState, type SubmitEvent } from 'react';
import { InvoiceEmailTest } from './invoice-email-test';
import {
  billingSettingsSchema,
  invoiceNumber,
  invoiceStatuses,
  type JobInvoice,
} from '@/lib/billing';
export function BillingSettings({
  onReview,
}: {
  onReview: (id: string) => void;
}) {
  const [invoices, setInvoices] = useState<JobInvoice[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [values, setValues] = useState({
    payee_name: '',
    bank_name: '',
    iban: '',
  });
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/admin/billing?page=${page}`, { signal: controller.signal })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        if (d.settings) setValues(d.settings);
        setInvoices(d.invoices || []);
        setTotal(d.total || 0);
        setReady(true);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setMessage(e.message);
      });
    return () => controller.abort();
  }, [page]);
  async function save(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = billingSettingsSchema.safeParse(values);
    if (!parsed.success) {
      setMessage(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const r = await fetch('/api/admin/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setMessage(
        'რეკვიზიტები შენახულია. ცვლილება მხოლოდ ახალ ინვოისებზე გავრცელდება.',
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'შენახვა ვერ მოხერხდა');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <InvoiceEmailTest />
      <section className="billing-invoices">
        <h2>ინვოისები</h2>
        {invoices.map((inv) => (
          <article key={inv.token}>
            <div>
              <strong>
                {invoiceNumber(inv.number, inv.created_at)} · {inv.amount_gel} ₾
              </strong>
              <p>
                {inv.payer_name} · {inv.vacancy_title}
              </p>
              <span>{invoiceStatuses[inv.status]}</span>
            </div>
            <div>
              <a
                href={`/invoices/${inv.token}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                ინვოისის ნახვა
              </a>
              <button
                type="button"
                className="secondary-button"
                onClick={() => onReview(inv.job_id)}
              >
                განცხადების მართვა
              </button>
            </div>
          </article>
        ))}
        {ready && !invoices.length && <p>ინვოისები ჯერ არ არის.</p>}
        <div className="invoice-list-pages">
          {page > 1 && (
            <button type="button" onClick={() => setPage((p) => p - 1)}>
              წინა
            </button>
          )}
          {page * 30 < total && (
            <button type="button" onClick={() => setPage((p) => p + 1)}>
              შემდეგი
            </button>
          )}
        </div>
      </section>
      <form className="billing-settings notice" onSubmit={save}>
        <h2>ინვოისის რეკვიზიტები</h2>
        <p>
          პრემიუმი — 20 ₾ / 14 დღე. თანხა ირიცხება აქ მითითებულ ანგარიშზე;
          ჩარიცხვას ადმინისტრატორი ადასტურებს.
        </p>
        {(
          [
            ['payee_name', 'მიმღების სახელი და გვარი'],
            ['bank_name', 'ბანკის დასახელება'],
            ['iban', 'ანგარიშის ნომერი (IBAN)'],
          ] as const
        ).map(([key, label]) => (
          <label key={key}>
            {label}
            <input
              value={values[key]}
              onInput={(e) => {
                const value = e.currentTarget.value;
                setValues((v) => ({ ...v, [key]: value }));
              }}
              onChange={() => {}}
              required
              maxLength={key === 'iban' ? 32 : 200}
              disabled={!ready || busy}
            />
          </label>
        ))}
        <button className="primary" disabled={!ready || busy}>
          {busy ? 'ინახება…' : 'რეკვიზიტების შენახვა'}
        </button>
        {message && <p role="alert">{message}</p>}
      </form>
    </>
  );
}
