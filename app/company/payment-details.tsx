'use client';

import { useState } from 'react';
import { invoiceNumber, type CompanyInvoiceDetails } from '@/lib/billing';
import './billing.css';

function CopyValue({ label, value }: { label: string; value: string }) {
  const [feedback, setFeedback] = useState('');
  async function copy() {
    setFeedback('');
    try {
      try {
        await navigator.clipboard.writeText(value);
      } catch {
        const focused = document.activeElement;
        const field = document.createElement('textarea');
        field.value = value;
        field.readOnly = true;
        field.style.position = 'fixed';
        field.style.opacity = '0';
        document.body.append(field);
        try {
          field.select();
          if (!document.execCommand('copy')) throw new Error('Copy failed');
        } finally {
          field.remove();
          if (focused instanceof HTMLElement) focused.focus({ preventScroll: true });
        }
      }
      setFeedback('დაკოპირდა');
    } catch {
      setFeedback('კოპირება ვერ მოხერხდა. მონიშნეთ და დააკოპირეთ ტექსტი.');
    }
  }
  return <div className="cp-payment-copy">
    <span>{value}</span>
    <button type="button" className="cp-btn cp-btn--ghost cp-btn--sm" aria-label={`${label} — კოპირება`} onClick={() => void copy()}>კოპირება</button>
    <small role="status" aria-live="polite">{feedback}</small>
  </div>;
}

export function PaymentDetails({ invoice, nextNote }: { invoice: CompanyInvoiceDetails; nextNote?: string }) {
  return <section className="cp-payment-details" aria-label="გადახდის მონაცემები">
    <p>{invoice.placementTier === 'vip' ? 'VIP' : 'სუპერ VIP'} განთავსება · {invoice.serviceDays} დღე</p>
    <dl>
      <div><dt>მიმღები</dt><dd>{invoice.payeeName}</dd></div>
      <div><dt>ბანკი</dt><dd>{invoice.bankName}</dd></div>
      <div><dt>IBAN</dt><dd><CopyValue label="IBAN" value={invoice.iban} /></dd></div>
      <div><dt>დანიშნულება</dt><dd><CopyValue label="დანიშნულება" value={`ინვოისი №${invoiceNumber(invoice.number)}`} /></dd></div>
    </dl>
    <div className="cp-payment-next">
      <p>{nextNote ?? 'ჩარიცხვის დადასტურების შემდეგ'} განთავსება გააქტიურდება {invoice.serviceDays} დღით.</p>
    </div>
    <a className="cp-btn cp-btn--ghost" href={`/invoices/${invoice.token}`} target="_blank" rel="noreferrer">ინვოისის გახსნა / PDF-ის შენახვა</a>
  </section>;
}
