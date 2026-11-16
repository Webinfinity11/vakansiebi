import test from 'node:test';
import assert from 'node:assert/strict';
import { applicationsEmail, deadlineEmail, candidateAckEmail } from '../lib/notification-emails';
import { autoReplyReady, defaultTemplates, render } from '../lib/company-message-templates';

const origin = 'https://jobx.ge', recipient = 'owner@example.com';
test('application summary contains counts and a cabinet link, escapes vacancy titles', () => {
  const email = applicationsEmail([{ title: '<script>alert(1)</script>', count: 3 }], recipient, origin);
  assert.match(email.html, /&lt;script&gt;/);
  assert.doesNotMatch(email.html, /<script>/);
  assert.match(email.text, /3 განაცხადი/);
  assert.match(email.text, /https:\/\/jobx.ge\/company\?tab=candidates/);
  assert.deepEqual(email.to, [recipient]);
  assert.doesNotMatch(email.html, /tel:|\+995/);
});
test('deadline link opens the confirmation page, never invokes a mutation', () => {
  const email = deadlineEmail({ id: 'abc', title: 'ბუღალტერი', deadline: '2026-11-19' }, recipient, origin);
  assert.match(email.html, /\/company\/jobs\/abc\/extend/);
  assert.doesNotMatch(email.html, /\/api\//);
  for (const content of [email.subject, email.text, email.html]) {
    assert.match(content, /19 ნოემბერი/);
    assert.doesNotMatch(content, /2026-11-19/);
  }
});
test('acknowledgement renders the selected template as escaped text in JOBX layout', () => {
  const template = render(defaultTemplates.received, { name: '<img src=x>', companyName: 'კომპანია', jobTitle: 'ბუღალტერი' });
  const email = candidateAckEmail(template, 'candidate@example.com', origin);
  assert.match(email.html, /&lt;img/);
  assert.match(email.html, /კომპანიის სახელით, JOBX-ის მეშვეობით/);
  assert.ok(email.text.startsWith(template.body + '\n\n'));
  assert.doesNotMatch(email.html, /შენს განაცხადზე/);
  assert.doesNotMatch(email.text, /\{სახელი\}|\{ვაკანსია\}|\{კომპანია\}/);
});
test('notification templates reject unsafe recipients and origins', () => {
  assert.throws(() => applicationsEmail([], 'a@example.com\r\nBcc: b@example.com', origin));
  assert.throws(() => deadlineEmail({ id: 'a', title: 'b', deadline: 'c' }, recipient, 'javascript:alert(1)'));
});

test('auto reply templates must have no unfilled placeholders after rendering', () => {
  assert.equal(autoReplyReady(defaultTemplates.received), true);
  assert.equal(autoReplyReady(defaultTemplates.interview), false);
  assert.equal(autoReplyReady(defaultTemplates.information), false);
  assert.equal(autoReplyReady({ subject: 'გასაუბრება', body: 'გასაუბრება 19 ნოემბერს გაიმართება.' }), true);
  assert.equal(autoReplyReady({ subject: '{უცნობი}', body: 'მივიღეთ' }), false);
  assert.equal(autoReplyReady({ subject: '[შეავსეთ]', body: 'მივიღეთ' }), false);
});
test('deadline copy reflects remaining calendar days including today', () => {
  for (const days of [0, 1, 2, 3]) {
    const email = deadlineEmail({ id: 'abc', title: 'ბუღალტერი', deadline: `2026-11-${16 + days}` }, recipient, origin, '2026-11-16');
    for (const content of [email.subject, email.text, email.html]) assert.ok(content.includes(days === 0 ? 'დღეს' : `${days} დღეში`));
  }
});
