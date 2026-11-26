import test from 'node:test';
import assert from 'node:assert/strict';

void test('setup tokens carry the account and expire after 7 days', async () => {
  process.env.SESSION_SECRET ||= 'test-company-session-secret-32-bytes-long';
  const { companySetupToken, parseSetupToken } = await import('../lib/server/company-setup');
  const id = '0b6a6a3e-6f0e-4c39-9a64-4b1d2f8c9e11', now = Date.now();
  const token = companySetupToken(id, 'scrypt1:hash', now);
  assert.equal(parseSetupToken(token, now)?.id, id);
  assert.equal(parseSetupToken(token, now + 8 * 86400000), null, 'expired');
  assert.equal(parseSetupToken('not-a-token'), null);
});
