import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { Client } from 'pg';

/* An admin hands a company (e.g. a bank asking to manage its vacancies) an email and a
   password; every vacancy under any of its names moves to that account, now and later. */
void test(
  'admin handover: chosen password, other names, later vacancies and changed login',
  { skip: process.env.RUN_DB_TESTS !== '1' },
  async () => {
    const url = new URL(process.env.DATABASE_URL!);
    assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
    assert.equal(url.pathname, '/ertad_test');
    const schema = 'handover_' + randomUUID().replaceAll('-', '');
    const c = new Client({ connectionString: url.href });
    await c.connect();
    const originalUrl = process.env.DATABASE_URL;
    process.env.COMPANY_PORTAL_ENABLED = 'true';
    process.env.SESSION_SECRET ||= 'test-company-session-secret-32-bytes-long';
    try {
      await c.query(`CREATE SCHEMA ${schema}`);
      await c.query(`SET search_path TO ${schema}`);
      for (const name of readdirSync('db/migrations').filter((n) => n.endsWith('.sql')).sort())
        await c.query(readFileSync('db/migrations/' + name, 'utf8'));
      url.searchParams.set('options', '-c search_path=' + schema);
      process.env.DATABASE_URL = url.href;
      const { db } = await import('../lib/server/db');
      const { createCompanyAccount, changeCompanyAccount, companyAccounts } = await import('../lib/server/company-accounts');
      const { loginCompany, companyIdentity } = await import('../lib/server/company-auth');
      const { companyJobs } = await import('../lib/server/company-jobs');
      const job = async (company: string) => {
        const vacancy = {
          title: 'ოპერატორი', company, city: 'თბილისი', category: 'ფინანსები', salary: '', salaryMin: null,
          currency: '', salaryPeriod: '', mode: 'ადგილზე', description: 'სამუშაო აღწერა',
          url: 'https://example.org/' + randomUUID(), source: 'hr', deadline: '', datePosted: '2026-11-17',
        };
        await db().query(
          `INSERT INTO jobs(id,draft,published,status,fingerprint,published_at) VALUES($1,$2,$2,'published',$3,now())`,
          [randomUUID(), vacancy, randomUUID()],
        );
      };
      await job('თიბისი ბანკი');
      await job('სს „თიბისი ბანკი“');
      await job('TBC Bank');
      await job('სხვა კომპანია');

      await assert.rejects(
        createCompanyAccount({ name: 'თიბისი ბანკი', username: 'tbc', email: 'hr@tbc.example', password: 'short', confirmed: true }),
      );
      const created = await createCompanyAccount({
        name: 'თიბისი ბანკი',
        username: 'tbc',
        email: 'hr@tbc.example',
        password: 'Tbc-Admin-Pass-2026',
        mustChangePassword: false,
        aliases: ['სს „თიბისი ბანკი“'],
        attachJobs: true,
        confirmed: true,
      });
      assert.equal(created.password, 'Tbc-Admin-Pass-2026');
      assert.equal(created.mustChangePassword, false);
      assert.equal(created.attached, 2);

      // The company signs in with the email and the password it was given.
      let me = (await companyIdentity(await loginCompany('hr@tbc.example', 'Tbc-Admin-Pass-2026', '127.0.0.1')))!;
      assert.equal(me.mustChangePassword, false);
      assert.equal(me.approvalStatus, 'approved');
      assert.equal((await companyJobs(me)).length, 2);

      const account = () => companyAccounts().then((rows) => rows.find((a) => a.username === 'tbc')!);
      let row = await account();
      const added = await changeCompanyAccount({ action: 'add-alias', id: row.id, version: row.version, name: 'TBC Bank' });
      assert.equal(added.attached, 1);
      assert.deepEqual((await account()).aliases, ['სს „თიბისი ბანკი“', 'TBC Bank']);

      // A vacancy published later under one of the names joins on the next visit.
      await job('TBC Bank');
      assert.equal((await companyJobs(me)).length, 4);

      // A name another company's account already uses is not taken over.
      await createCompanyAccount({ name: 'სხვა კომპანია', username: 'other', email: 'hr@other.example', confirmed: true });
      row = await account();
      await assert.rejects(
        changeCompanyAccount({ action: 'add-alias', id: row.id, version: row.version, name: 'სხვა კომპანია' }),
        /სხვა კომპანიის ანგარიშს/,
      );

      // New login details end old sessions; the new password must be changed if asked.
      row = await account();
      const login = await changeCompanyAccount({
        action: 'set-login', id: row.id, version: row.version,
        email: 'jobs@tbc.example', password: 'Second-Pass-2026!', mustChangePassword: true,
      });
      assert.equal(login.password, 'Second-Pass-2026!');
      await assert.rejects(loginCompany('hr@tbc.example', 'Second-Pass-2026!', '127.0.0.2'));
      me = (await companyIdentity(await loginCompany('jobs@tbc.example', 'Second-Pass-2026!', '127.0.0.2')))!;
      assert.equal(me.mustChangePassword, true);
      row = await account();
      await assert.rejects(
        changeCompanyAccount({ action: 'set-login', id: row.id, version: row.version, email: 'hr@other.example' }),
        /სხვა ანგარიშს/,
      );

      // Removing a name stops future joins but keeps what is attached.
      row = await account();
      await changeCompanyAccount({ action: 'remove-alias', id: row.id, version: row.version, name: 'TBC Bank' });
      assert.deepEqual((await account()).aliases, ['სს „თიბისი ბანკი“']);
      await job('TBC Bank');
      const after = await db().query(
        `SELECT count(*)::int n FROM company_job_ownership o JOIN company_accounts a USING(company_key) WHERE a.username='tbc'`,
      );
      assert.equal(after.rows[0].n, 4);
      await db().end();
    } finally {
      process.env.DATABASE_URL = originalUrl;
      await c.query(`DROP SCHEMA ${schema} CASCADE`);
      await c.end();
    }
  },
);
