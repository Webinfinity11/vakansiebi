import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  alertToken,
  readAlertToken,
  confirmationEmail,
  digestEmail,
  alertLink,
} from '../lib/job-alerts';
import { analyticsPage } from '../lib/google-analytics';

void test('alert links are signed, expire for confirmation, and cannot change action', () => {
  const id = randomUUID(),
    nonce = randomUUID(),
    secret = 'job-alert-test-secret-with-more-than-32-characters',
    now = Date.now();
  const token = alertToken(id, nonce, 'confirm', secret, now + 1000);
  assert.deepEqual(readAlertToken(token, 'confirm', secret, now), {
    id,
    nonce,
  });
  assert.equal(readAlertToken(token, 'confirm', secret, now + 1001), null);
  assert.equal(readAlertToken(token, 'unsubscribe', secret, now), null);
  assert.equal(
    readAlertToken(token.replace(id, randomUUID()), 'confirm', secret, now),
    null,
  );
  assert.equal(readAlertToken('x', 'confirm', secret), null);
  const unsubscribe = alertToken(id, nonce, 'unsubscribe', secret);
  assert.deepEqual(
    readAlertToken(unsubscribe, 'unsubscribe', secret, now + 365 * 86400000),
    { id, nonce },
  );
  assert.equal(
    analyticsPage(alertLink('https://jobx.ge', token, 'confirm')),
    null,
  );
});
void test('email markup escapes source text and includes a signed unsubscribe route', () => {
  const message = confirmationEmail(
    'reader@example.invalid',
    '<img src=x onerror=alert(1)>',
    'https://jobx.ge/job-alerts?token=fixture&action=confirm',
    'https://jobx.ge',
  );
  assert.ok(!message.html.includes('<img src=x'));
  const email = digestEmail(
    'reader@example.invalid',
    'მოლარე',
    [
      {
        id: randomUUID(),
        group_key: 'x',
        title: '<script>bad</script>',
        company: 'A & B',
        salary: '1000 ₾',
        city: 'თბილისი',
      },
    ],
    'https://jobx.ge/?q=molare',
    'https://jobx.ge/job-alerts?token=fixture&action=unsubscribe',
    'https://jobx.ge',
  );
  assert.ok(!email.html.includes('<script>'));
  assert.equal(
    email.headers?.['List-Unsubscribe-Post'],
    'List-Unsubscribe=One-Click',
  );
  assert.ok(
    email.headers?.['List-Unsubscribe'].includes('/api/job-alerts/manage?'),
  );
});
