'use client';
import { useState, type SubmitEvent } from 'react';

export function InvoiceEmailTest() {
  const [email, setEmail] = useState('');
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
        სატესტო წერილი გაიგზავნება invoice@jobx.ge-დან. ინვოისი არ შეიქმნება.
      </p>
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
      <button className="primary" disabled={busy}>
        {busy ? 'იგზავნება…' : 'სატესტო წერილის გაგზავნა'}
      </button>
      {message && <output>{message}</output>}
    </form>
  );
}
