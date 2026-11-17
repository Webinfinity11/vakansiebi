import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

void test(
  'JOBX CV base: visible to a company, joins its candidates only after an action, CV opens',
  { skip: process.env.RUN_COMPANY_DB_TESTS !== '1' },
  async () => {
    const url = new URL(process.env.DATABASE_URL!);
    assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
    assert.equal(url.pathname, '/jobx_company_local');
    const { db } = await import('../lib/server/db');
    const { companyCvBase, companyCandidates, changeCandidate, candidateCv, revealCandidate, baseDailyLimit } =
      await import('../lib/server/company-candidates');
    const key = 'cvbaseqa' + randomUUID().replaceAll('-', '');
    const resume = randomUUID();
    const company = {
      id: randomUUID(),
      companyKey: key,
      name: 'CV base QA',
      username: key,
      email: key + '@example.com',
      mustChangePassword: false,
      role: 'owner' as const,
      approvalStatus: 'approved' as const,
      emailVerified: true,
      representativeName: 'QA',
    };
    try {
      await db().query('INSERT INTO company_profiles(company_key,name) VALUES($1,$2)', [key, company.name]);
      await db().query(
        `INSERT INTO company_accounts(id,company_key,username,email,password_hash) VALUES($1,$2,$3,$4,'x')`,
        [company.id, key, key.slice(0, 60), company.email],
      );
      await db().query(
        'INSERT INTO resumes(id,delete_token_hash,cv) VALUES($1,$2,$3)',
        [resume, 'x'.repeat(64), JSON.stringify({
          fullName: 'ნინო ბაზიძე', title: 'ბუღალტერი', city: 'თბილისი', email: 'nino.base@example.com',
          skills: ['1C', 'Excel'], experience: [{ role: 'ბუღალტერი', company: 'შპს QA', from: '2019-01', to: '2023-01', current: false, description: '' }],
        })],
      );
      const entry = 'base:r:' + resume;

      const base = await companyCvBase(company);
      const person = base.find((c) => c.entry === entry);
      assert.ok(person, 'resume appears in the CV base');
      assert.equal(person.source, 'base');
      assert.equal(person.name, 'ნინო ბაზიძე');
      // Contacts stay closed until the company asks; the person is still recognisable.
      assert.equal(person.email, '');
      assert.equal(person.contactHidden, true);
      assert.ok(person.person);
      assert.doesNotMatch(person.profile?.text ?? '', /nino\.base@example\.com/);
      assert.deepEqual(person.profile?.skills, ['1C', 'Excel']);
      assert.equal(person.profile?.years, 4);
      assert.ok(!(await companyCandidates(company)).some((c) => c.entry === entry), 'not a candidate yet');

      await changeCandidate(company, { action: 'seen', entry });
      assert.ok(!(await companyCandidates(company)).some((c) => c.entry === entry), 'viewing alone does not add');

      await changeCandidate(company, { action: 'stage', entries: [entry], stage: 'interview' });
      const tracked = (await companyCandidates(company)).find((c) => c.entry === entry);
      assert.equal(tracked?.stage, 'interview', 'an action adds the person to the company candidates');

      const shown = await revealCandidate(company, entry);
      assert.equal(shown.email, 'nino.base@example.com');
      assert.equal(shown.contactHidden, undefined);
      assert.equal((await companyCvBase(company)).find((c) => c.entry === entry)?.email, 'nino.base@example.com');
      const file = await candidateCv(company, entry);
      assert.equal(file?.type, 'application/pdf');
      const views = await db().query('SELECT kind, account_id FROM company_cv_base_views WHERE company_key=$1 ORDER BY id', [key]);
      assert.deepEqual(views.rows.map((r) => r.kind), ['contact', 'cv']);

      // A daily cap stops copying the base; people already opened stay open.
      const other = randomUUID();
      await db().query(
        `INSERT INTO company_cv_base_views(company_key,entry,kind)
         SELECT $1,'base:r:'||gen_random_uuid(),'contact' FROM generate_series(1,$2)`,
        [key, baseDailyLimit],
      );
      await db().query('INSERT INTO resumes(id,delete_token_hash,cv) VALUES($1,$2,$3)', [
        other, 'x'.repeat(64), JSON.stringify({ fullName: 'გიორგი ლიმიტი', email: 'g@example.com', summary: 'x'.repeat(40) }),
      ]);
      await assert.rejects(revealCandidate(company, 'base:r:' + other), /დღეში/);
      assert.equal((await revealCandidate(company, entry)).email, 'nino.base@example.com');

      // The person can take their resume out of the base.
      await db().query(`UPDATE resumes SET cv=cv||'{"listed":false}' WHERE id=$1`, [other]);
      assert.ok(!(await companyCvBase(company)).some((c) => c.entry === 'base:r:' + other));
      await db().query('DELETE FROM resumes WHERE id=$1', [other]);

      await db().query('UPDATE resumes SET expires_at=now()-interval \'1 day\' WHERE id=$1', [resume]);
      assert.ok(!(await companyCvBase(company)).some((c) => c.entry === entry), 'expired resumes leave the base');
    } finally {
      await db().query('DELETE FROM company_cv_base_views WHERE company_key=$1', [key]);
      await db().query('DELETE FROM company_candidate_states WHERE company_key=$1', [key]);
      await db().query('DELETE FROM company_accounts WHERE company_key=$1', [key]);
      await db().query('DELETE FROM company_profiles WHERE company_key=$1', [key]);
      await db().query('DELETE FROM resumes WHERE id=$1', [resume]);
      await db().end();
    }
  },
);
