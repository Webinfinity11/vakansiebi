import test from 'node:test';
import assert from 'node:assert/strict';
import { invoiceEmail } from '../lib/invoice-email';
import { invoiceContact, type JobInvoice } from '../lib/billing';
import { GET } from '../app/api/cron/invoice-email/route';
const invoice: JobInvoice = {
  id: '00000000-0000-4000-8000-000000000001',
  job_id: '00000000-0000-4000-8000-000000000002',
  token: 'a'.repeat(64),
  number: '7',
  amount_gel: 20,
  service_days: 14,
  payer_name: '<img src=x onerror=alert(1)>',
  vacancy_title: 'Designer & Developer',
  payee_name: 'TEST recipient',
  bank_name: 'TEST bank',
  iban: 'TEST ACCOUNT',
  status: 'pending',
  created_at: '2026-09-15T10:00:00Z',
  paid_at: null,
  activated_at: null,
};
void test('invoice mail escapes user content, links the private invoice and has the requested phone', () => {
  const email = invoiceEmail(invoice, 'billing@example.com', 'https://jobx.ge');
  assert.deepEqual(email.to, ['billing@example.com']);
  assert.deepEqual(email.bcc, ['invoice@jobx.ge']);
  assert.equal(email.from, 'JOBX <invoice@jobx.ge>');
  assert.equal(email.reply_to, 'invoice@jobx.ge');
  assert.match(email.html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(email.html, /<img src=x/);
  assert.match(email.html, /Designer &amp; Developer/);
  assert.ok(email.html.includes(`https://jobx.ge/invoices/${invoice.token}`));
  assert.ok(email.html.includes(`tel:${invoiceContact.telephone}`));
  assert.ok(email.text.includes(invoiceContact.phone));
  assert.ok(email.subject.includes('JOBX-2026-000007'));
});
void test('mail does not duplicate the owner address and rejects malformed destinations and links', () => {
  assert.equal(
    invoiceEmail(invoice, 'INVOICE@jobx.ge', 'https://jobx.ge').bcc,
    undefined,
  );
  assert.throws(() =>
    invoiceEmail(
      invoice,
      'a@example.com\r\nBcc: thief@example.com',
      'https://jobx.ge',
    ),
  );
  assert.throws(() =>
    invoiceEmail(invoice, 'a@example.com', 'javascript:alert(1)'),
  );
  assert.throws(() =>
    invoiceEmail(invoice, 'a@example.com', 'http://evil.example'),
  );
  assert.throws(() =>
    invoiceEmail(
      { ...invoice, token: '../bad' },
      'a@example.com',
      'https://jobx.ge',
    ),
  );
});
void test('test copies use the selected invoice button and only the test recipient', () => {
  const mail = invoiceEmail(
    invoice,
    'owner@example.com',
    'https://jobx.ge',
    'owner@example.com',
    true,
  );
  assert.deepEqual(mail.to, ['owner@example.com']);
  assert.equal(mail.bcc, undefined);
  assert.match(mail.subject, /^\[ტესტი\]/);
  assert.match(
    mail.html,
    new RegExp(
      `<a href="https://jobx.ge/invoices/${invoice.token}"[^>]*>ინვოისის ნახვა</a>`,
    ),
  );
  assert.doesNotMatch(mail.html, /JOBX-ზე გადასვლა/);
  assert.ok(mail.text.includes(`https://jobx.ge/invoices/${invoice.token}`));
});
void test('invoice delivery endpoint fails closed without the correct cron secret', async () => {
  assert.equal(
    (await GET(new Request('https://jobx.ge/api/cron/invoice-email'))).status,
    401,
  );
  assert.equal(
    (
      await GET(
        new Request('https://jobx.ge/api/cron/invoice-email', {
          headers: { authorization: 'Bearer wrong' },
        }),
      )
    ).status,
    401,
  );
});
