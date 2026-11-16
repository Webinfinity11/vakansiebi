import test from 'node:test';
import assert from 'node:assert/strict';
import { trustedByHistory } from '../lib/server/trusted-companies';
import { adminReviewEmail } from '../lib/admin-review-email';
import { invoiceContact } from '../lib/billing';

void test('trust requires three publications and no rejection', () => {
  for (const approved of [0, 1, 2]) assert.equal(trustedByHistory({ approved, rejected: 0 }), false);
  for (const approved of [3, 4, 100]) assert.equal(trustedByHistory({ approved, rejected: 0 }), true);
  for (const rejected of [1, 2, 100]) assert.equal(trustedByHistory({ approved: 10, rejected }), false);
});
void test('admin summary has counts, at most five names per group, safe admin link and no phone', () => {
  const email = adminReviewEmail({ jobs: ['<script>მოლარე</script>', 'ორი', 'სამი', 'ოთხი'], companies: ['კომპანია', 'დამალული კომპანია'], autoPublished: ['გამოქვეყნებული ვაკანსია'] }, 'admin@example.com', 'https://jobx.ge/ignored');
  assert.match(email.text, /4 ახალი ვაკანსია და 2 კომპანიის ანგარიში/);
  assert.match(email.text, /1 ავტომატურად/);
  assert.match(email.text, /და კიდევ 1/);
  assert.match(email.html, /href="https:\/\/jobx.ge\/admin"/);
  assert.match(email.html, /&lt;script&gt;/);
  for (const content of [email.text, email.html]) {
    assert.match(content, /შემოწმებას ელოდება/);
    assert.match(content, /ავტომატურად გამოქვეყნდა — გადახედეთ/);
    assert.match(content, /გამოქვეყნებული ვაკანსია/);
    assert.ok(content.indexOf('ავტომატურად გამოქვეყნდა — გადახედეთ') < content.lastIndexOf('გამოქვეყნებული ვაკანსია'));
  }
  assert.match(email.html, /<p style="line-height:1.7">/);
  assert.match(email.text, /ადმინის პანელის გახსნა: https:\/\/jobx.ge\/admin/);
  assert.doesNotMatch(email.html + email.text, /დამალული|tel:|ტელეფონი/);
  assert.doesNotMatch(email.html, /<script>/);
  assert.equal(email.from, `JOBX <${invoiceContact.email}>`);
  assert.throws(() => adminReviewEmail({ jobs: [], companies: [], autoPublished: [] }, 'bad', 'https://jobx.ge'));
});
