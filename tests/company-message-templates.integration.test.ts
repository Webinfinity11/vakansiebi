import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { defaultTemplates } from '../lib/company-message-templates';
test('company templates are team shared, tenant scoped, permission checked and resettable', { skip: process.env.RUN_COMPANY_DB_TESTS !== '1' }, async () => {
  const url = new URL(process.env.DATABASE_URL!);
  assert.ok(['localhost', '127.0.0.1'].includes(url.hostname)); assert.equal(url.pathname, '/jobx_company_local');
  const { db } = await import('../lib/server/db');
  const { companyMessageTemplates: get, saveCompanyMessageTemplate: save } = await import('../lib/server/company-message-templates');
  const key = 'templateqa' + randomUUID(); const other = key + 'other';
  const owner = { id: randomUUID(), companyKey: key, name: 'QA', username: key, email: 'qa@example.com', mustChangePassword: false, role: 'owner' as const, approvalStatus: 'approved' as const, emailVerified: true, representativeName: 'QA' };
  try {
    await db().query('INSERT INTO company_profiles(company_key,name) VALUES($1,$1),($2,$2)', [key, other]);
    await assert.rejects(save({ ...owner, role: 'viewer' }, { kind: 'rejected', subject: 'x', body: 'y' }), (e: any) => e.status === 403);
    await save(owner, { kind: 'rejected', subject: 'სათაური', body: 'გამარჯობა, {სახელი}' });
    assert.equal((await get({ ...owner, role: 'viewer' })).rejected.subject, 'სათაური');
    assert.deepEqual(await get({ ...owner, companyKey: other }), defaultTemplates);
    await save({ ...owner, role: 'recruiter' }, { kind: 'rejected', subject: 'გუნდის შაბლონი', body: 'ტექსტი' });
    assert.equal((await get(owner)).rejected.subject, 'გუნდის შაბლონი');
    await assert.rejects(save(owner, { kind: 'rejected', subject: 'x'.repeat(201), body: 'x' }));
    await assert.rejects(save(owner, { kind: 'unknown', reset: true }));
    await assert.rejects(save({ ...owner, role: 'viewer' }, { kind: 'rejected', reset: true }));
    await save(owner, { kind: 'rejected', reset: true });
    assert.deepEqual(await get(owner), defaultTemplates);
  } finally { await db().query('DELETE FROM company_profiles WHERE company_key=ANY($1::text[])', [[key, other]]); await db().end(); }
});
