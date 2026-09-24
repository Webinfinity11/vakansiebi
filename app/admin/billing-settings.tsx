'use client';
import { useEffect, useState, type SubmitEvent } from 'react';
import { InvoiceEmailTest } from './invoice-email-test';
import {
  billingSettingsSchema,
  invoiceNumber,
  invoiceStatuses,
  type JobInvoice,
} from '@/lib/billing';
import { placementLabels, type PlacementTier } from '@/lib/placement';
type Placement = {
  id: string;
  title: string | null;
  company: string | null;
  tier: PlacementTier;
  expires_at: string;
  invoice_status: keyof typeof invoiceStatuses | null;
};
type Totals = {
  this_month: number;
  last_month: number;
  awaiting: number;
  awaiting_count: number;
  refunds_due: number;
  refunds_due_count: number;
};
const day = 86400000;
/* Whole days left, rounded up, so a promotion ending tonight reads "1 დღე" rather than "0". */
function daysLeft(expires: string, now: number) {
  return Math.max(1, Math.ceil((Date.parse(expires) - now) / day));
}
export function BillingSettings({
  onReview,
}: {
  onReview: (id: string) => void;
}) {
  const [invoices, setInvoices] = useState<JobInvoice[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loadedAt, setLoadedAt] = useState(0);
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
        setPlacements(d.placements || []);
        setTotals(d.totals || null);
        setLoadedAt(Date.now());
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
      {totals && (
        <dl className="billing-totals">
          <div>
            <dt>ამ თვეში გადახდილი</dt>
            <dd>{totals.this_month} ₾</dd>
          </div>
          <div>
            <dt>წინა თვეში</dt>
            <dd>{totals.last_month} ₾</dd>
          </div>
          <div>
            <dt>გადახდის მოლოდინში</dt>
            <dd>
              {totals.awaiting} ₾ <small>({totals.awaiting_count})</small>
            </dd>
          </div>
          <div data-alert={totals.refunds_due_count > 0 || undefined}>
            <dt>დასაბრუნებელი</dt>
            <dd>
              {totals.refunds_due} ₾ <small>({totals.refunds_due_count})</small>
            </dd>
          </div>
        </dl>
      )}
      <section className="billing-invoices billing-placements">
        <h2>აქტიური განთავსებები</h2>
        {placements.map((p) => {
          const left = daysLeft(p.expires_at, loadedAt);
          return (
            <article key={p.id}>
              <div>
                <strong>
                  {placementLabels[p.tier]} · {p.title || 'ვაკანსია'}
                </strong>
                <p>
                  {p.company}
                  {p.invoice_status &&
                    ` · ${invoiceStatuses[p.invoice_status]}`}
                </p>
                <span data-soon={left <= 3 || undefined}>
                  დარჩა {left} დღე ·{' '}
                  {new Date(p.expires_at).toLocaleDateString('ka-GE', {
                    timeZone: 'Asia/Tbilisi',
                  })}
                  -მდე
                </span>
              </div>
              <div>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => onReview(p.id)}
                >
                  განცხადების მართვა
                </button>
              </div>
            </article>
          );
        })}
        {ready && !placements.length && (
          <p>აქტიური VIP ან პრემიუმ განთავსება არ არის.</p>
        )}
      </section>
      <InvoiceEmailTest invoices={invoices} />
      <section className="billing-invoices">
        <h2>ინვოისები</h2>
        {invoices.map((inv) => (
          <article key={inv.token}>
            <div>
              <strong>
                {invoiceNumber(inv.number)} · {inv.amount_gel} ₾
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
