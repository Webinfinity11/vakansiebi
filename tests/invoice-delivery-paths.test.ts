import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/* An invoice e-mail must leave the moment its invoice is created. The hourly
   cron only retries; on 2026-11-26 company-account submissions queued their
   invoices without sending them, so a customer waited for the next cron run.
   Every API route that can create an invoice must therefore also trigger
   delivery after its response. A new route that forgets it fails here. */

const creators = /\b(submitJob|changeCompanyJob|upgradeCompanyJob|requestCompanyPlacement|createInvoice|createInvoiceDetails)\s*\(/;
const delivers = /\b(deliverInvoiceEmails|deliverInvoiceEmailsAfterResponse)\s*\(/;

function routes(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return routes(path);
    return /^route\.tsx?$/.test(name) ? [path] : [];
  });
}

void test('every route that can create an invoice sends its e-mail at once', () => {
  const creating = routes('app/api').filter((path) => creators.test(readFileSync(path, 'utf8')));
  // The known paths must still be found, so the pattern itself cannot rot.
  for (const known of ['app/api/submissions/route.ts', 'app/api/company/jobs/route.ts', 'app/api/company/billing/route.ts'])
    assert.ok(creating.includes(known), `${known} no longer matches the invoice-creating pattern`);
  const missing = creating.filter((path) => !delivers.test(readFileSync(path, 'utf8')));
  assert.deepEqual(missing, [], `these routes create invoices but never send them immediately: ${missing.join(', ')}`);
});

void test('the immediate sender stays enabled and scoped to due invoices', () => {
  const helper = readFileSync('lib/server/invoice-email-after.ts', 'utf8');
  assert.match(helper, /after\(/);
  assert.match(helper, /deliverInvoiceEmails\(/);
});
