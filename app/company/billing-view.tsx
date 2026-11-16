'use client';
import './billing.css';
import { StatusMark } from './status-mark';
import { useCallback, useEffect, useState } from 'react';
import {
  invoiceContact,
  invoiceNumber,
  invoiceServiceLabel,
  invoiceStatuses,
  type JobInvoice,
} from '@/lib/billing';
import { companyRequest, formatDate } from './company-api';

type Billing = {
  invoices: JobInvoice[];
  settings: { payee_name: string; bank_name: string; iban: string } | null;
};
export function BillingView() {
  const [data, setData] = useState<Billing | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      setData(await companyRequest('billing'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ინვოისები ვერ ჩაიტვირთა.');
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <>
      <header className="cp-head">
        <div className="cp-head-title">
          <h1>გადახდები</h1>
          <p>ინვოისები და გადახდის რეკვიზიტები</p>
        </div>
        <button
          type="button"
          className="cp-btn cp-btn--primary"
          disabled={busy}
          onClick={() => void load()}
        >
          განახლება
        </button>
      </header>
      {error && (
        <p className="cp-alert" role="alert">
          {error}
        </p>
      )}
      {busy && !data && <p role="status">იტვირთება…</p>}
      {data && (
        <>
          <section className="cp-settings">
            <div className="cp-settings-row">
              <div className="cp-settings-label">
                <h2>ინვოისები</h2>
                <p>
                  ინვოისის გვერდზე „ბეჭდვა / PDF“-ით ფაილის შენახვაც შეგიძლიათ.
                </p>
              </div>
              <div className="cp-fields">
                {!data.invoices.length && <div className="cp-billing-empty"><p>ინვოისი ჯერ არ გაქვთ.</p><a className="cp-btn cp-btn--ghost" href="/company">ვაკანსიების სია</a></div>}
                {data.invoices.map((invoice) => (
                  <article className="cp-invoice" key={invoice.id}>
                    <h3>ინვოისი {invoiceNumber(invoice.number)}</h3>
                    <p>{invoice.vacancy_title}</p>
                    <p>
                      {invoiceServiceLabel(invoice)} · {invoice.amount_gel} ₾ ·{' '}
                      {invoice.service_days} დღე
                    </p>
                    <p>
                      <StatusMark kind={invoice.status}>{invoiceStatuses[invoice.status]}</StatusMark> ·{' '}
                      {formatDate(invoice.created_at)}
                    </p>
                    {invoice.status === 'paid' && !invoice.activated_at && (
                      <p className="cp-subtle">
                        განთავსება ელოდება JOBX-ის გუნდის დადასტურებას.
                      </p>
                    )}
                    <a
                      className="cp-btn cp-btn--ghost cp-btn--sm"
                      href={`/invoices/${invoice.token}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      ნახვა / PDF-ის შენახვა
                    </a>
                  </article>
                ))}
              </div>
            </div>
            <div className="cp-settings-row">
              <div className="cp-settings-label">
                <h2>რეკვიზიტები</h2>
                <p>
                  გადარიცხვისას გამოიყენეთ კონკრეტულ ინვოისზე მითითებული
                  რეკვიზიტები და დანიშნულებაში ჩაწერეთ ინვოისის ნომერი.
                </p>
              </div>
              <div className="cp-fields">
                {data.settings ? (
                  <dl className="cp-facts">
                    <div>
                      <dt>მიმღები</dt>
                      <dd>{data.settings.payee_name}</dd>
                    </div>
                    <div>
                      <dt>ბანკი</dt>
                      <dd>{data.settings.bank_name}</dd>
                    </div>
                    <div>
                      <dt>IBAN</dt>
                      <dd style={{ overflowWrap: 'anywhere' }}>
                        {data.settings.iban}
                      </dd>
                    </div>
                  </dl>
                ) : (
                  <p>გადახდის რეკვიზიტები ჯერ არ არის დამატებული.</p>
                )}
                <a href={`mailto:${invoiceContact.email}`}>
                  {invoiceContact.email}
                </a>
              </div>
            </div>
          </section>
        </>
      )}
    </>
  );
}
