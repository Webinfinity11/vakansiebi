'use client';
import { useState, type SubmitEvent } from 'react';
import { invoiceNumber, type JobInvoice } from '@/lib/billing';

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
    <form className="billing-settings notice" onSubmit={send}>
      <h2>ელფოსტის გაგზავნის შემოწმება</h2>
      <p>
        აირჩიე ინვოისი — წერილში მისი დეტალები და პირდაპირი ბმული გაიგზავნება.
      </p>
      <label>
        სატესტო ინვოისი
        <select
          value={invoiceToken}
          onChange={(event) => setInvoiceToken(event.target.value)}
          required
          disabled={busy || !invoices.length}
        >
          <option value="">აირჩიე ინვოისი</option>
          {invoices.map((invoice) => (
            <option key={invoice.token} value={invoice.token}>
              {invoiceNumber(invoice.number, invoice.created_at)} ·{' '}
              {invoice.payer_name} · {invoice.vacancy_title}
            </option>
          ))}
        </select>
      </label>
      <label>
        მიმღების ელფოსტა
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          maxLength={254}
          disabled={busy}
        />
      </label>
      <button
        className="primary"
        disabled={
          busy || !invoices.some((invoice) => invoice.token === invoiceToken)
        }
      >
        {busy ? 'იგზავნება…' : 'სატესტო წერილის გაგზავნა'}
      </button>
      {message && <output>{message}</output>}
    </form>
  );
}
