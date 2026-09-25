'use client';
import { adminDate } from '@/lib/admin-format';
import { useEffect, useState, type SubmitEvent } from 'react';
import { ExternalLink } from 'lucide-react';
import { SkeletonRows } from '../skeleton';
import { InvoiceEmailTest } from './invoice-email-test';
import {
  billingSettingsSchema,
  invoiceNumber,
  invoiceStatuses,
  premiumDays,
  premiumPriceGEL,
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
/* Each invoice state in the colour of its meaning, the same badges as every other status. */
const invoiceTone: Record<keyof typeof invoiceStatuses, string> = {
  pending: 'ds-badge ds-badge--warning',
  paid: 'ds-badge ds-badge--success',
  cancelled: 'ds-badge',
  refund_required: 'ds-badge ds-badge--danger',
  refunded: 'ds-badge',
};
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
      {!ready && !message && (
        <SkeletonRows rows={2} block label="ინვოისები იტვირთება" />
      )}
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
      <section className="billing-invoices billing-placements ds-card">
        <h2>აქტიური განთავსებები</h2>
        {placements.map((p) => {
          const left = daysLeft(p.expires_at, loadedAt);
          return (
            <article key={p.id}>
              <div>
                <strong>
                  <span
                    className={
                      p.tier === 'premium'
                        ? 'ds-badge ds-badge--violet'
                        : 'ds-badge ds-badge--accent'
                    }
                  >
                    {placementLabels[p.tier]}
                  </span>
                  {p.title || 'ვაკანსია'}
                </strong>
                <p>{p.company}</p>
                <span className="billing-meta">
                  {p.invoice_status && (
                    <span className={invoiceTone[p.invoice_status]}>
                      {invoiceStatuses[p.invoice_status]}
                    </span>
                  )}
                  <span data-soon={left <= 3 || undefined}>
                    დარჩა {left} დღე · {adminDate(p.expires_at)}-მდე
                  </span>
                </span>
              </div>
              <div>
                <button
                  type="button"
                  className="ds-btn ds-btn--secondary ds-btn--sm"
                  onClick={() => onReview(p.id)}
                >
                  განცხადების მართვა
                </button>
              </div>
            </article>
          );
        })}
        {ready && !placements.length && (
          <p className="billing-empty">
            აქტიური VIP ან პრემიუმ განთავსება არ არის.
          </p>
        )}
      </section>
      <InvoiceEmailTest invoices={invoices} />
      <section className="billing-invoices ds-card">
        <h2>ინვოისები</h2>
        {invoices.map((inv) => (
          <article key={inv.token}>
            <div>
              <strong className="billing-number">
                {invoiceNumber(inv.number)} · {inv.amount_gel} ₾
              </strong>
              <p>
                {inv.payer_name} · {inv.vacancy_title}
              </p>
              <span className={invoiceTone[inv.status]}>
                {invoiceStatuses[inv.status]}
              </span>
            </div>
            <div>
              <a
                className="ds-btn ds-btn--ghost ds-btn--sm"
                href={`/invoices/${inv.token}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink size={16} aria-hidden="true" />
                ინვოისის ნახვა
              </a>
              <button
                type="button"
                className="ds-btn ds-btn--secondary ds-btn--sm"
                onClick={() => onReview(inv.job_id)}
              >
                განცხადების მართვა
              </button>
            </div>
          </article>
        ))}
        {ready && !invoices.length && (
          <p className="billing-empty">ინვოისები ჯერ არ არის.</p>
        )}
        <div className="invoice-list-pages">
          {page > 1 && (
            <button
              type="button"
              className="ds-btn ds-btn--secondary ds-btn--sm"
              onClick={() => setPage((p) => p - 1)}
            >
              წინა
            </button>
          )}
          {page * 30 < total && (
            <button
              type="button"
              className="ds-btn ds-btn--secondary ds-btn--sm"
              onClick={() => setPage((p) => p + 1)}
            >
              შემდეგი
            </button>
          )}
        </div>
      </section>
      <form className="billing-settings ds-card" onSubmit={save}>
        <h2>ინვოისის რეკვიზიტები</h2>
        <p>
          პრემიუმი — {premiumPriceGEL} ₾ / {premiumDays} დღე. თანხა ირიცხება აქ
          მითითებულ ანგარიშზე; ჩარიცხვას ადმინისტრატორი ადასტურებს.
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
              className="ds-input"
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
        <button className="ds-btn ds-btn--primary" disabled={!ready || busy}>
          {busy && <span className="ds-spinner" aria-hidden="true" />}
          {busy ? 'ინახება…' : 'რეკვიზიტების შენახვა'}
        </button>
        {message && (
          <p role="alert" className="billing-message">
            {message}
          </p>
        )}
      </form>
    </>
  );
}
