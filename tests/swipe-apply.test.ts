import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cvAttachmentName,
  swipeApplicationEmail,
} from '../lib/swipe-apply-email';
import { swipeRecipient, resendSink } from '../lib/server/swipe-apply';

const job = {
  id: '00000000-0000-4000-8000-000000000002',
  title: 'მოლარე <b>',
  company: 'ფიქსტურა & Co',
};
const pdf = Buffer.from('%PDF-1.4 test');

void test('the swipe letter leaves hr@jobx.ge with the reader as Reply-To and the CV attached', () => {
  const mail = swipeApplicationEmail(
    job,
    {
      name: 'ნინო ბერიძე',
      email: 'nino@example.com',
      phone: '+995 555 12 34 56',
    },
    'jobs@company.ge',
    pdf,
    'https://jobx.ge',
  );
  assert.equal(mail.from, 'JOBX <hr@jobx.ge>');
  assert.deepEqual(mail.to, ['jobs@company.ge']);
  assert.equal(mail.reply_to, 'nino@example.com');
  assert.equal(mail.subject, 'განაცხადი: მოლარე <b> — ნინო ბერიძე');
  assert.match(mail.html, /მოლარე &lt;b&gt;/);
  assert.doesNotMatch(mail.html, /<b>/);
  assert.match(mail.html, /ფიქსტურა &amp; Co/);
  assert.match(mail.text, /\+995 555 12 34 56/);
  assert.match(
    mail.text,
    /https:\/\/jobx\.ge\/vacancies\/[^\s]*00000000-0000-4000-8000-000000000002/,
  );
  assert.deepEqual(mail.attachments, [
    { filename: 'CV-ნინო-ბერიძე.pdf', content: pdf.toString('base64') },
  ]);
});

void test('a bad reader address or recipient is refused before anything is sent', () => {
  assert.throws(() =>
    swipeApplicationEmail(
      job,
      { name: 'a', email: 'nope', phone: '' },
      'jobs@company.ge',
      pdf,
      'https://jobx.ge',
    ),
  );
  assert.throws(() =>
    swipeApplicationEmail(
      job,
      { name: 'a', email: 'a@b.ge', phone: '' },
      'not an address',
      pdf,
      'https://jobx.ge',
    ),
  );
  assert.equal(cvAttachmentName('  '), 'CV-JOBX.pdf');
  assert.equal(cvAttachmentName('Nino / Beridze'), 'CV-Nino-Beridze.pdf');
});

void test('outside production every letter goes to the delivery sink unless an address is set', () => {
  const previous = {
    to: process.env.SWIPE_APPLY_TO,
    env: process.env.NODE_ENV,
  };
  try {
    delete process.env.SWIPE_APPLY_TO;
    assert.equal(swipeRecipient('jobs@company.ge'), resendSink);
    process.env.SWIPE_APPLY_TO = 'me@example.com';
    assert.equal(swipeRecipient('jobs@company.ge'), 'me@example.com');
    process.env.SWIPE_APPLY_TO = 'not an address';
    assert.equal(swipeRecipient('jobs@company.ge'), resendSink);
  } finally {
    if (previous.to === undefined) delete process.env.SWIPE_APPLY_TO;
    else process.env.SWIPE_APPLY_TO = previous.to;
  }
});
