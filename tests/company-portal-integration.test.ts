import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { Client } from 'pg';
import { db } from '../lib/server/db';
import {
  createCompanyAccount,
  changeCompanyAccount,
  companyAccounts,
} from '../lib/server/company-accounts';
import {
  loginCompany,
  companyIdentity,
  changeCompanyPassword,
} from '../lib/server/company-auth';
import { changeCompanyJob, companyJobs } from '../lib/server/company-jobs';
import { newCompanyJob } from '../lib/company-job-form';
import { saveCompany } from '../lib/server/companies';
import { mutateJob } from '../lib/server/jobs';
void test(
  'company accounts enforce first password change, ownership, moderation, idempotency and session revocation',
  { skip: process.env.RUN_DB_TESTS !== '1' },
  async () => {
    const url = new URL(process.env.DATABASE_URL!);
    assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
    assert.equal(url.pathname, '/ertad_test');
    const schema = 'company_' + randomUUID().replaceAll('-', '');
    const c = new Client({ connectionString: url.href });
    await c.connect();
    const originalUrl = process.env.DATABASE_URL;
    const enabled = process.env.COMPANY_PORTAL_ENABLED;
    const secret = process.env.SESSION_SECRET;
    process.env.COMPANY_PORTAL_ENABLED = 'true';
    process.env.SESSION_SECRET = 'test-company-session-secret-32-bytes-long';
    try {
      await c.query(`CREATE SCHEMA ${schema}`);
      await c.query(`SET search_path TO ${schema}`);
      for (const name of readdirSync('db/migrations')
        .filter((n) => n.endsWith('.sql'))
        .sort())
        await c.query(readFileSync('db/migrations/' + name, 'utf8'));
      url.searchParams.set('options', '-c search_path=' + schema);
      process.env.DATABASE_URL = url.href;
      const a = await createCompanyAccount({
        name: 'ტესტ კომპანია ალფა',
        username: 'test-alpha',
        email: 'alpha@example.org',
        confirmed: true,
      });
      const b = await createCompanyAccount({
        name: 'ტესტ კომპანია ბეტა',
        username: 'test-beta',
        email: 'beta@example.org',
        confirmed: true,
      });
      assert.ok(!JSON.stringify(await companyAccounts()).includes(a.password));
      await assert.rejects(
        loginCompany('test-alpha', 'wrong', '127.0.0.1'),
        /არასწორია/,
      );
      const temp = await loginCompany('test-alpha', a.password, '127.0.0.1');
      const first = (await companyIdentity(temp))!;
      assert.ok(first.mustChangePassword);
      const form = {
        ...newCompanyJob(),
        title: 'კონსულტანტი',
        category: 'გაყიდვები',
        deadline: new Date(Date.now() + 86400000 * 20)
          .toISOString()
          .slice(0, 10),
        description:
          'ვეძებთ კონსულტანტს სრული განაკვეთით. მოვალეობაა მომხმარებლის დახმარება და პროდუქციის გაცნობა.',
        contact: 'alpha@example.org',
        salaryFrom: '1200',
        salaryTo: '1500',
      };
      await assert.rejects(
        changeCompanyJob(first, {
          action: 'create',
          requestId: randomUUID(),
          form,
        }),
        /წვდომა|პაროლ|კომპანი/,
      );
      const password = 'Changed-Password-2026!';
      await changeCompanyPassword(first, a.password, password);
      assert.equal(await companyIdentity(temp), null);
      const token = await loginCompany('test-alpha', password, '127.0.0.1');
      const owner = (await companyIdentity(token))!;
      assert.equal(owner.mustChangePassword, false);
      const requestId = randomUUID();
      await changeCompanyJob(owner, { action: 'create', requestId, form });
      await changeCompanyJob(owner, { action: 'create', requestId, form });
      const jobs = await companyJobs(owner);
      assert.equal(jobs.length, 1);
      assert.equal(jobs[0].status, 'pending');
      const bTemp = await loginCompany('test-beta', b.password, '127.0.0.2');
      const bFirst = (await companyIdentity(bTemp))!;
      await changeCompanyPassword(bFirst, b.password, password);
      const other = (await companyIdentity(
        await loginCompany('test-beta', password, '127.0.0.2'),
      ))!;
      assert.equal((await companyJobs(other)).length, 0);
      await assert.rejects(
        changeCompanyJob(other, {
          action: 'save',
          id: jobs[0].id,
          version: jobs[0].version,
          form,
        }),
        /ვერ მოიძებნა/,
      );
      await assert.rejects(
        saveCompany(
          {
            name: owner.name,
            website: '',
            logoUrl: '',
            description: 'hijacked',
            version: 1,
          },
          { accountId: other.id, companyKey: other.companyKey },
        ),
        /დაუშვებელია/,
      );
      await assert.rejects(
        mutateJob(
          { action: 'publish', id: jobs[0].id, version: jobs[0].version },
          { accountId: owner.id, companyKey: owner.companyKey },
        ),
        /დაუშვებელია/,
      );
      const saved = await saveCompany(
        {
          name: owner.name,
          website: 'https://example.org/',
          logoUrl: '',
          description: 'კომპანიის აღწერა',
          version: 1,
        },
        { accountId: owner.id, companyKey: owner.companyKey },
      );
      assert.equal(saved.version, 2);
      const live = (
        await c.query('SELECT draft FROM jobs WHERE id=$1', [jobs[0].id])
      ).rows[0].draft;
      await c.query(
        "UPDATE jobs SET status='published',published=draft,published_at=now() WHERE id=$1",
        [jobs[0].id],
      );
      await changeCompanyJob(owner, {
        action: 'save',
        id: jobs[0].id,
        version: jobs[0].version,
        form: { ...form, title: 'განახლებული კონსულტანტი' },
      });
      const revised = (
        await c.query(
          'SELECT version,published,draft,needs_review FROM jobs WHERE id=$1',
          [jobs[0].id],
        )
      ).rows[0];
      assert.equal(revised.published.title, live.title);
      assert.notEqual(revised.draft.title, live.title);
      assert.equal(revised.needs_review, true);
      await assert.rejects(
        changeCompanyJob(owner, {
          action: 'save',
          id: jobs[0].id,
          version: jobs[0].version,
          form,
        }),
        /შეიცვალა/,
      );
      await changeCompanyJob(owner, {
        action: 'archive',
        id: jobs[0].id,
        version: revised.version,
      });
      assert.equal((await companyJobs(owner))[0].status, 'archived');
      const acct = (await companyAccounts()).find(
        (row: { id: string }) => row.id === owner.id,
      );
      await changeCompanyAccount({
        action: 'reset-password',
        id: owner.id,
        version: acct.version,
      });
      assert.equal(await companyIdentity(token), null);
      await assert.rejects(
        loginCompany('test-alpha', password, '127.0.0.1'),
        /არასწორია/,
      );
      await assert.rejects(
        changeCompanyJob(owner, {
          action: 'create',
          requestId: randomUUID(),
          form,
        }),
        /წვდომა|პაროლ|კომპანი/,
      );
      const audit = (await c.query('SELECT after_data FROM audit_log')).rows;
      assert.ok(!JSON.stringify(audit).includes(a.password));
    } finally {
      await db().end();
      delete (globalThis as { ertadPool?: unknown }).ertadPool;
      process.env.DATABASE_URL = originalUrl;
      if (enabled === undefined) delete process.env.COMPANY_PORTAL_ENABLED;
      else process.env.COMPANY_PORTAL_ENABLED = enabled;
      if (secret === undefined) delete process.env.SESSION_SECRET;
      else process.env.SESSION_SECRET = secret;
      await c.query(`DROP SCHEMA ${schema} CASCADE`);
      await c.end();
    }
  },
);
