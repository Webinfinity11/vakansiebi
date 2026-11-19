import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

void test(
  'a company registers with name, email and password, then gives its details later',
  { skip: process.env.RUN_COMPANY_DB_TESTS !== '1' },
  async () => {
    const url = new URL(process.env.DATABASE_URL!);
    assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
    assert.equal(url.pathname, '/jobx_company_local');
    process.env.COMPANY_PORTAL_ENABLED = 'true';
    process.env.SESSION_SECRET ||= 'local-dev-session-secret-0123456789abcdef';
    const { db } = await import('../lib/server/db');
    const { registerCompany, updateCompanyDetails } = await import('../lib/server/company-accounts');
    const { companyIdentity } = await import('../lib/server/company-auth');
    const { missingCompanyDetails } = await import('../lib/company-registration');
    const tag = randomUUID().slice(0, 8);
    const name = `დეტალების ტესტი ${tag}`;
    const email = `details-${tag}@example.com`;
    let key = '';
    try {
      const { token } = await registerCompany(
        { name, email, password: 'strong-password-2026' },
        'test-network-' + tag,
      );
      const me = await companyIdentity(token);
      assert.ok(me);
      key = me.companyKey;
      assert.equal(me.approvalStatus, 'pending');
      assert.deepEqual(missingCompanyDetails(me.details!), ['საკონტაქტო პირი', 'თანამდებობა', 'ტელეფონი']);

      const code = String(100000000 + Math.floor(Math.random() * 899999999));
      await updateCompanyDetails(me, { code, representativeName: 'ანა ტესტი', position: 'HR მენეჯერი', phone: '+995 555 12 34 56' });
      const after = await companyIdentity(token);
      assert.deepEqual(after!.details, { code, representativeName: 'ანა ტესტი', position: 'HR მენეჯერი', phone: '+995 555 12 34 56' });
      assert.deepEqual(missingCompanyDetails(after!.details!), []);

      // Invalid input is refused; only the owner may change the details.
      await assert.rejects(updateCompanyDetails(me, { code: '123' }));
      await assert.rejects(updateCompanyDetails({ ...me, role: 'recruiter' }, { phone: '+995 555 00 00 00' }), /მფლობელს/);

      // Once approved the checked code stays, other details can still change.
      await db().query("UPDATE company_profiles SET approval_status='approved' WHERE company_key=$1", [key]);
      const kept = await updateCompanyDetails(me, { code: '999999999', representativeName: 'ნინო', position: 'დირექტორი', phone: '+995 599 00 00 00' });
      assert.equal(kept.code, code);
      assert.equal(kept.representativeName, 'ნინო');
    } finally {
      if (key) {
        await db().query('DELETE FROM company_sessions WHERE account_id IN (SELECT id FROM company_accounts WHERE company_key=$1)', [key]);
        await db().query('DELETE FROM company_email_tokens WHERE account_id IN (SELECT id FROM company_accounts WHERE company_key=$1)', [key]);
        await db().query('DELETE FROM company_accounts WHERE company_key=$1', [key]);
        await db().query('DELETE FROM company_profiles WHERE company_key=$1', [key]);
      }
      await db().end();
    }
  },
);
