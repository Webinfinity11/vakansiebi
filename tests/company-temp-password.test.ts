import test from 'node:test';
import assert from 'node:assert/strict';

void test('temporary company passwords are short, readable and pass the length rule', async () => {
  process.env.SESSION_SECRET ||= 'test-company-session-secret-32-bytes-long';
  const { newCompanyPassword } = await import('../lib/server/company-auth');
  const { companyPassword } = await import('../lib/company-portal');
  const seen = new Set<string>();
  for (let i = 0; i < 200; i++) {
    const p = newCompanyPassword();
    assert.match(p, /^[a-hj-km-np-z2-9]{4}-[a-hj-km-np-z2-9]{4}$/);
    assert.ok(companyPassword.safeParse(p).success);
    seen.add(p);
  }
  assert.ok(seen.size > 195);
  assert.ok(!companyPassword.safeParse('short').success);
  assert.ok(companyPassword.safeParse('abcd1234').success);
});
