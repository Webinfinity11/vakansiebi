import test from 'node:test';
import assert from 'node:assert/strict';

/* Runs only against a separate test database: `RUN_DB_TESTS=1` with DATABASE_URL pointing at it. */
void test(
  'one address running out of login attempts does not lock out another',
  { skip: process.env.RUN_DB_TESTS !== '1' },
  async () => {
    process.env.SESSION_SECRET ||=
      'test-secret-that-is-long-enough-for-tests-only';
    const { db, transaction } = await import('../lib/server/db');
    const { clientTag, recordLoginAttempt, perClientLimit } =
      await import('../lib/server/login-attempts');
    const attacker = clientTag('203.0.113.9');
    const admin = clientTag('198.51.100.4');
    assert.notEqual(attacker, admin);
    assert.doesNotMatch(attacker, /203/);
    const attempt = (client: string) =>
      transaction((c) => recordLoginAttempt(c, client));
    try {
      await db().query('DELETE FROM login_attempts');
      for (let i = 0; i < perClientLimit; i++) await attempt(attacker);
      await assert.rejects(attempt(attacker), { status: 429 });
      await attempt(admin);
    } finally {
      await db().query('DELETE FROM login_attempts');
    }
  },
);

void test('an IPv6 network counts as one login client', async () => {
  const { clientNetwork } = await import('../lib/server/login-attempts');
  assert.equal(clientNetwork('2001:db8:1:2:3:4:5:6'), '2001:db8:1:2::/64');
  assert.equal(clientNetwork('2001:0db8:1:2::9'), '2001:db8:1:2::/64');
  assert.equal(clientNetwork('203.0.113.9'), '203.0.113.9');
  assert.equal(clientNetwork('::ffff:203.0.113.9'), '::ffff:203.0.113.9');
});
