import test from 'node:test';
import assert from 'node:assert/strict';
import { scryptSync } from 'node:crypto';
import {
  verifyPassword,
  verifySession,
  sessionToken,
  checkOrigin,
} from '../lib/server/auth';
process.env.SESSION_SECRET = 'test-secret-that-is-long-enough-for-tests-only';
process.env.ADMIN_PASSWORD_HASH =
  'salt:' + scryptSync('test-password', 'salt', 64).toString('hex');
process.env.APP_URL = 'http://localhost:3000';
void test('admin password verification rejects incorrect and oversized input', () => {
  assert.equal(verifyPassword('test-password'), true);
  assert.equal(verifyPassword('bad'), false);
  assert.equal(verifyPassword('x'.repeat(300)), false);
});
void test('signed sessions reject tampering, missing values and expiration', () => {
  const token = sessionToken();
  assert.equal(verifySession(token), true);
  assert.equal(verifySession(token + 'x'), false);
  assert.equal(verifySession(undefined), false);
  assert.equal(verifySession('1.nonce.deadbeef'), false);
});
void test('mutations require same-origin browser requests', () => {
  assert.doesNotThrow(() =>
    checkOrigin(
      new Request('http://localhost:3000/api/admin/jobs', {
        headers: { origin: 'http://localhost:3000' },
      }),
    ),
  );
  assert.throws(() =>
    checkOrigin(
      new Request('http://localhost:3000/api/admin/jobs', {
        headers: { origin: 'https://evil.test' },
      }),
    ),
  );
  assert.throws(() =>
    checkOrigin(new Request('http://localhost:3000/api/admin/jobs')),
  );
});
