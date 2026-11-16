import test from 'node:test';
import assert from 'node:assert/strict';
import { rejectionReasons, rejectionSchema, rejectionText, rejectionLabels, rejectionGuidance } from '../lib/job-rejection';
import { jobRejectionEmail } from '../lib/job-rejection-email';
import { invoiceContact } from '../lib/billing';

void test('reasons validate, trim notes and require an explanation for other', () => {
  for (const reason of rejectionReasons) {
    assert.equal(rejectionSchema.safeParse({ reason, note: ' განმარტება ' }).success, true);
    assert.ok(rejectionLabels[reason]);
    assert.ok(rejectionGuidance[reason].startsWith('გთხოვთ') || reason === 'duplicate');
  }
  assert.equal(rejectionSchema.safeParse({ reason: 'other', note: '  ' }).success, false);
  assert.equal(rejectionSchema.safeParse({ reason: 'invalid' }).success, false);
  assert.equal(rejectionSchema.safeParse({ reason: 'rules', note: 'ა'.repeat(501) }).success, false);
  assert.equal(rejectionSchema.parse({ reason: 'incomplete' }).note, '');
  assert.equal(rejectionText('other', ' შენიშვნა '), 'სხვა — შენიშვნა');
});
void test('rejection email explains the reason, escapes content and only links owned vacancies', () => {
  const job = { id: '00000000-0000-4000-8000-000000000001', title: '<script>ბარისტა</script>', owned: true };
  const rejection = { reason: 'other', note: '<b>დააზუსტეთ სამუშაო საათები</b>' };
  const mail = jobRejectionEmail(job, rejection, 'hr@example.com', 'https://jobx.ge');
  assert.match(mail.html, /&lt;script&gt;/);
  assert.match(mail.html, /&lt;b&gt;დააზუსტეთ სამუშაო საათები/);
  assert.match(mail.text, /დააზუსტეთ სამუშაო საათები/);
  assert.ok(mail.html.includes(`/company/jobs/${job.id}/edit`));
  assert.ok(mail.text.includes('გასწორება და ხელახლა გაგზავნა'));
  assert.doesNotMatch(mail.html, /tel:|ტელეფონი|<script>/);
  assert.equal(mail.from, `JOBX <${invoiceContact.email}>`);
  assert.equal(mail.reply_to, invoiceContact.email);
  const unowned = jobRejectionEmail({ ...job, owned: false }, rejection, 'hr@example.com', 'https://jobx.ge');
  assert.doesNotMatch(unowned.html + unowned.text, /\/company\/jobs\/|გასწორება და ხელახლა გაგზავნა/);
  assert.throws(() => jobRejectionEmail(job, rejection, 'a@example.com\r\nBcc:b@example.com', 'https://jobx.ge'));
});
