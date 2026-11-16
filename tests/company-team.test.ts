import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { CompanyIdentity } from '../lib/company-portal';

void test('team listing isolates pending invitations and preserves member permissions', async () => {
  const url = new URL(process.env.DATABASE_URL || 'postgresql://localhost/invalid');
  assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
  assert.equal(url.pathname, '/jobx_company_local', 'only the authorized local DB');
  const { db } = await import('../lib/server/db');
  const { companyTeam, changeCompanyMember } = await import('../lib/server/company-accounts');
  const key = `team-test-${randomUUID()}`;
  const other = `${key}-other`;
  const owner = randomUUID(), member = randomUUID();
  const company = { id: owner, companyKey: key } as CompanyIdentity;
  try {
    await db().query('INSERT INTO company_profiles(company_key,name) VALUES($1,$1),($2,$2)', [key, other]);
    for (const [id, role] of [[owner, 'owner'], [member, 'recruiter']]) {
      await db().query('INSERT INTO company_accounts(id,company_key,username,email,password_hash,role) VALUES($1,$2,$3,$4,$5,$6)',
        [id, key, `team-test-${id}`, `team-test-${id}@example.com`, 'test-not-a-login-hash', role]);
    }
    for (const [companyKey, hours] of [[key, 72], [key, -1], [other, 72]] as const) {
      const id = randomUUID();
      await db().query("INSERT INTO company_team_invitations(id,company_key,email,role,token_hash,expires_at) VALUES($1,$2,$3,'viewer',$4,now()+$5*interval '1 hour')",
        [id, companyKey, `team-test-${id}@example.com`, id, hours]);
    }
    const team = await companyTeam(company);
    assert.equal(team.members.length, 2);
    assert.equal(team.invitations.length, 1, 'expired and other-company invites excluded');
    const invite = team.invitations[0];
    assert.equal(new Date(invite.expires_at).getTime() - new Date(invite.sent_at).getTime(), 72 * 3600000);
    await changeCompanyMember(company, { id: member, action: 'viewer' });
    assert.equal((await companyTeam(company)).members.find((m) => m.id === member)?.role, 'viewer');
    await changeCompanyMember(company, { id: member, action: 'remove' });
    assert.equal((await companyTeam(company)).members.find((m) => m.id === member)?.enabled, false);
    await changeCompanyMember(company, { id: member, action: 'enable' });
    assert.equal((await companyTeam(company)).members.find((m) => m.id === member)?.enabled, true);
    await assert.rejects(changeCompanyMember(company, { id: owner, action: 'remove' }));
    await assert.rejects(changeCompanyMember({ ...company, companyKey: other }, { id: member, action: 'remove' }));
    await changeCompanyMember({ ...company, companyKey: other }, { id: invite.id, action: 'cancel' });
    assert.equal((await companyTeam(company)).invitations.length, 1);
    await changeCompanyMember(company, { id: invite.id, action: 'cancel' });
    assert.equal((await companyTeam(company)).invitations.length, 0);
  } finally {
    await db().query('DELETE FROM company_team_invitations WHERE company_key=ANY($1)', [[key, other]]);
    await db().query("DELETE FROM company_accounts WHERE company_key=$1 AND email LIKE 'team-test-%@example.com'", [key]);
    await db().query('DELETE FROM company_profiles WHERE company_key=ANY($1)', [[key, other]]);
    await db().end();
  }
});
