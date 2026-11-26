import { after } from 'next/server';
import { deliverInvoiceEmails, invoiceEmailEnabled } from './invoice-email';

/** After a response that may have queued an invoice, send it at once instead of
    waiting for the hourly cron, which remains the retry. Safe on every such
    request: with nothing due it is one indexed query. Kept apart from
    invoice-email.ts so the worker never loads next/server. */
export function deliverInvoiceEmailsAfterResponse() {
  if (!invoiceEmailEnabled()) return;
  after(() =>
    deliverInvoiceEmails(undefined, 3)
      .then(() => {})
      .catch(() => {
        console.error('Invoice email delivery deferred');
      }),
  );
}
