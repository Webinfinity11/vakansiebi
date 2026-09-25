'use client';
import { useState, type SubmitEvent } from 'react';
import { invoiceNumber, type JobInvoice } from '@/lib/billing';
import { Send } from 'lucide-react';
import { SelectField } from '../select-field';

export function InvoiceEmailTest({ invoices }: { invoices: JobInvoice[] }) {
  const [email, setEmail] = useState('');
  const [invoiceToken, setInvoiceToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function send(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/admin/billing/email-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          requestId: crypto.randomUUID(),
          invoiceToken,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error);
      setMessage(
        'სერვისმა სატესტო წერილი მიიღო. შეამოწმე მიმღების ელფოსტა და სპამის საქაღალდე.',
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'გაგზავნა ვერ მოხერხდა.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="billing-settings ds-card" onSubmit={send}>
      <h2>ელფოსტის გაგზავნის შემოწმება</h2>
      <p>
        აირჩიე ინვოისი — წერილში მისი დეტალები და პირდაპირი ბმული გაიგზავნება.
      </p>
      <label htmlFor="invoice-test-token">
        სატესტო ინვოისი
        <SelectField
          id="invoice-test-token"
          value={invoiceToken}
          onChange={setInvoiceToken}
          placeholder="აირჩიე ინვოისი"
          disabled={busy || !invoices.length}
          options={invoices.map((invoice) => ({
            value: invoice.token,
            label: `${invoiceNumber(invoice.number)} · ${invoice.payer_name} · ${invoice.vacancy_title}`,
          }))}
        />
      </label>
      <label>
        მიმღების ელფოსტა
        <input
          className="ds-input"
          placeholder="name@example.ge"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          maxLength={254}
          disabled={busy}
        />
      </label>
      <button
        className="ds-btn ds-btn--primary"
        disabled={
          busy || !invoices.some((invoice) => invoice.token === invoiceToken)
        }
      >
        {busy ? (
          <span className="ds-spinner" aria-hidden="true" />
        ) : (
          <Send size={16} aria-hidden="true" />
        )}
        {busy ? 'იგზავნება…' : 'სატესტო წერილის გაგზავნა'}
      </button>
      {message && <output className="billing-message">{message}</output>}
    </form>
  );
}
