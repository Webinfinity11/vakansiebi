import test from 'node:test';
import assert from 'node:assert/strict';
import { applicationsEmail, placementRenewalEmail } from '../lib/notification-emails';

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
test('renewal email has a dative date, price, invoice link and ordinary placement explanation', () => {
  for (const placementTier of ['vip', 'premium'] as const) {
    const email = placementRenewalEmail({ placementTier, amountGel: 20, token: 'abc' }, 'ბუღალტერი <ტესტი>', new Date('2026-12-26T10:00:00Z'), recipient, origin);
    assert.match(email.subject, /ბუღალტერი <ტესტი>/);
    assert.match(email.text, /„ბუღალტერი <ტესტი>“/);
    assert.match(email.html, /ბუღალტერი &lt;ტესტი&gt;/);
    assert.doesNotMatch(email.html, /<ტესტი>/);
    assert.match(email.html, /\/invoices\/abc/);
    assert.doesNotMatch(email.html, /\/api\//);
    assert.match(email.text, /26 დეკემბერს/);
    assert.match(email.text, /20 ₾/);
    assert.match(email.text, /ჩვეულებრივ განთავსებად/);
    assert.deepEqual(email.to, [recipient]);
  }
});
test('notification templates reject unsafe recipients and origins', () => {
  assert.throws(() => applicationsEmail([], 'a@example.com\r\nBcc: b@example.com', origin));
  assert.throws(() => placementRenewalEmail({ placementTier: 'vip', amountGel: 20, token: 'abc' }, 'ბუღალტერი', new Date(), recipient, 'javascript:alert(1)'));
});

import { onDate } from '../lib/date-on';
test('dative date uses Tbilisi midnight and natural month forms', () => {
  assert.equal(onDate('2026-12-25T20:00:00Z'), '26 დეკემბერს');
  assert.equal(onDate('2026-12-25T19:59:59Z'), '25 დეკემბერს');
  const months = ['იანვარს', 'თებერვალს', 'მარტს', 'აპრილს', 'მაისს', 'ივნისს', 'ივლისს', 'აგვისტოს', 'სექტემბერს', 'ოქტომბერს', 'ნოემბერს', 'დეკემბერს'];
  months.forEach((month, index) => assert.equal(onDate(new Date(Date.UTC(2026, index, 2))), `2 ${month}`));
  assert.throws(() => onDate('invalid'), RangeError);
});
