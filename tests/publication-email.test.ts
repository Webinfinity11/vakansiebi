import test from 'node:test';
import assert from 'node:assert/strict';
import { publicationEmail } from '../lib/publication-email';
import { vacancyPath } from '../lib/vacancy-navigation';

void test('publication message is short, escaped and links the public vacancy, without invoice data or copies', () => {
  const job = {
    id: '00000000-0000-4000-8000-000000000001',
    title: 'ბარისტა <script>alert(1)</script>',
    company: 'A & B',
  };
  const mail = publicationEmail(job, 'owner@example.com', 'https://jobx.ge');
  assert.deepEqual(mail.to, ['owner@example.com']);
  assert.equal(mail.bcc, undefined);
  assert.ok(mail.text.includes('https://jobx.ge' + vacancyPath(job)));
  assert.match(mail.html, /&lt;script&gt;/);
  assert.match(mail.html, /A &amp; B/);
  assert.doesNotMatch(
    mail.html,
    /<script>|\/invoices\/|ინვოისთან ან გადახდასთან/,
  );
  assert.ok(mail.text.length < 600);
  assert.throws(() =>
    publicationEmail(
      job,
      'a@example.com\r\nBcc: other@example.com',
      'https://jobx.ge',
    ),
  );
  assert.throws(() =>
    publicationEmail(
      { ...job, id: '../../bad' },
      'a@example.com',
      'https://jobx.ge',
    ),
  );
});
