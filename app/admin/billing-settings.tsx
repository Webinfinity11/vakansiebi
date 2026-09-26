'use client';
import { adminDate } from '@/lib/admin-format';
import { useEffect, useState, type SubmitEvent } from 'react';
import { ChevronDown, ExternalLink, Pencil } from 'lucide-react';
import { SkeletonRows } from '../skeleton';
import { InvoiceEmailTest } from './invoice-email-test';
import './admin-records.css';
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
  const [saved, setSaved] = useState(values);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState('');
  const [loadError, setLoadError] = useState('');
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/admin/billing?page=${page}`, {
      signal: controller.signal,
      cache: 'no-store',
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error || 'ინვოისები ვერ ჩაიტვირთა');
        if (d.settings) {
          setValues(d.settings);
          setSaved(d.settings);
        }
        setInvoices(d.invoices || []);
        setTotal(d.total || 0);
        setPlacements(d.placements || []);
        setTotals(d.totals || null);
        setLoadedAt(Date.now());
        setLoadError('');
        setReady(true);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setLoadError(e.message);
      });
    return () => controller.abort();
  }, [page, version]);
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
      setSaved(parsed.data);
      setEditing(false);
      setMessage(
        'რეკვიზიტები შენახულია. ცვლილება მხოლოდ ახალ ინვოისებზე გავრცელდება.',
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'შენახვა ვერ მოხერხდა');
    } finally {
      setBusy(false);
    }
  }
  const payee = [
    ['payee_name', 'მიმღები'],
    ['bank_name', 'ბანკი'],
    ['iban', 'ანგარიში (IBAN)'],
  ] as const;
  return (
    <div className="records">
      {loadError && (
        <div role="alert" className="records-error">
          <p>{loadError}</p>
          <button
            type="button"
            className="ds-btn ds-btn--secondary ds-btn--sm"
            onClick={() => {
              setLoadError('');
              setVersion((n) => n + 1);
            }}
          >
            ხელახლა ცდა
          </button>
        </div>
      )}
      {!ready && !loadError && (
        <SkeletonRows rows={3} block label="ინვოისები იტვირთება" />
      )}
      {totals && (
        <dl className="billing-totals records-totals">
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
      {ready && (
        <>
          <section className="records-card ds-card" aria-labelledby="bl-live">
            <header>
              <h2 id="bl-live">
                აქტიური განთავსებები <b>{placements.length}</b>
              </h2>
            </header>
            {placements.length ? (
              <ul className="records-rows">
                {placements.map((p) => {
                  const left = daysLeft(p.expires_at, loadedAt);
                  return (
                    <li key={p.id}>
                      <div className="records-main">
                        <strong>{p.title || 'ვაკანსია'}</strong>
                        <span>{p.company}</span>
                      </div>
                      <span className="records-cell">
                        <span
                          className={
                            p.tier === 'premium'
                              ? 'ds-badge ds-badge--violet'
                              : 'ds-badge ds-badge--accent'
                          }
                        >
                          {placementLabels[p.tier]}
                        </span>
                        {p.invoice_status && (
                          <span className={invoiceTone[p.invoice_status]}>
                            {invoiceStatuses[p.invoice_status]}
                          </span>
                        )}
                      </span>
                      <span
                        className="records-cell records-num"
                        data-soon={left <= 3 || undefined}
                      >
                        დარჩა {left} დღე · {adminDate(p.expires_at)}-მდე
                      </span>
                      <span className="records-actions">
                        <button
                          type="button"
                          className="ds-btn ds-btn--secondary ds-btn--sm"
                          onClick={() => onReview(p.id)}
                        >
                          განცხადების მართვა
                        </button>
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="records-empty">
                აქტიური VIP ან პრემიუმ განთავსება არ არის.
              </p>
            )}
          </section>
          <section className="records-card ds-card" aria-labelledby="bl-inv">
            <header>
              <h2 id="bl-inv">
                ინვოისები <b>{total}</b>
              </h2>
            </header>
            {invoices.length ? (
              <ul className="records-rows records-rows--invoices">
                <li className="records-head" aria-hidden="true">
                  <span>ნომერი</span>
                  <span>გადამხდელი · ვაკანსია</span>
                  <span>თანხა</span>
                  <span>სტატუსი</span>
                  <span />
                </li>
                {invoices.map((inv) => (
                  <li key={inv.token}>
                    <span className="records-num records-strong">
                      {invoiceNumber(inv.number)}
                    </span>
                    <div className="records-main">
                      <strong>{inv.payer_name}</strong>
                      <span>{inv.vacancy_title}</span>
                    </div>
                    <span className="records-num records-strong">
                      {inv.amount_gel} ₾
                    </span>
                    <span className="records-cell">
                      <span className={invoiceTone[inv.status]}>
                        {invoiceStatuses[inv.status]}
                      </span>
                    </span>
                    <span className="records-actions">
                      <a
                        className="ds-btn ds-btn--secondary ds-btn--sm"
                        href={`/invoices/${inv.token}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink size={16} aria-hidden="true" />
                        ინვოისი
                      </a>
                      <button
                        type="button"
                        className="ds-btn ds-btn--ghost ds-btn--sm"
                        onClick={() => onReview(inv.job_id)}
                      >
                        განცხადება
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="records-empty">ინვოისები ჯერ არ არის.</p>
            )}
            {(page > 1 || page * 30 < total) && (
              <div className="records-pages">
                <span>
                  გვერდი {page} / {Math.max(1, Math.ceil(total / 30))}
                </span>
                <button
                  type="button"
                  className="ds-btn ds-btn--secondary ds-btn--sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  წინა
                </button>
                <button
                  type="button"
                  className="ds-btn ds-btn--secondary ds-btn--sm"
                  disabled={page * 30 >= total}
                  onClick={() => setPage((p) => p + 1)}
                >
                  შემდეგი
                </button>
              </div>
            )}
          </section>
          <section className="records-card ds-card" aria-labelledby="bl-payee">
            <header>
              <div>
                <h2 id="bl-payee">ინვოისის რეკვიზიტები</h2>
                <p>
                  პრემიუმი — {premiumPriceGEL} ₾ / {premiumDays} დღე. თანხა
                  ირიცხება ამ ანგარიშზე; ჩარიცხვას ადმინისტრატორი ადასტურებს.
                </p>
              </div>
              {!editing && (
                <button
                  type="button"
                  className="ds-btn ds-btn--secondary ds-btn--sm"
                  onClick={() => {
                    setMessage('');
                    setEditing(true);
                  }}
                >
                  <Pencil size={16} aria-hidden="true" />
                  რედაქტირება
                </button>
              )}
            </header>
            {editing ? (
              <form className="records-form" onSubmit={save}>
                <div className="records-fields">
                  {payee.map(([key, label]) => (
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
                        disabled={busy}
                      />
                    </label>
                  ))}
                </div>
                <div className="records-form-actions">
                  <button className="ds-btn ds-btn--primary" disabled={busy}>
                    {busy && <span className="ds-spinner" aria-hidden="true" />}
                    {busy ? 'ინახება…' : 'შენახვა'}
                  </button>
                  <button
                    type="button"
                    className="ds-btn ds-btn--secondary"
                    disabled={busy}
                    onClick={() => {
                      setValues(saved);
                      setMessage('');
                      setEditing(false);
                    }}
                  >
                    გაუქმება
                  </button>
                </div>
              </form>
            ) : (
              <dl className="records-values">
                {payee.map(([key, label]) => (
                  <div key={key}>
                    <dt>{label}</dt>
                    <dd data-mono={key === 'iban' || undefined}>
                      {saved[key] || 'არ არის მითითებული'}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            {message && <output className="records-message">{message}</output>}
          </section>
          <details className="records-card records-test ds-card">
            <summary>
              <ChevronDown size={16} aria-hidden="true" />
              ტესტი
              <span>ინვოისის წერილის სატესტო გაგზავნა</span>
            </summary>
            <InvoiceEmailTest invoices={invoices} />
          </details>
        </>
      )}
    </div>
  );
}
