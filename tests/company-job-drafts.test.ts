import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { Client } from 'pg';
import { db } from '../lib/server/db';
import {
  save,
  get,
  getForJob,
  list,
  remove,
} from '../lib/server/company-job-drafts';
import { createCompanyAccount } from '../lib/server/company-accounts';
import { changeCompanyJob, companyJobs } from '../lib/server/company-jobs';
import { newCompanyJob } from '../lib/company-job-form';
import { submissionDate } from '../lib/job-submission';
import type { CompanyIdentity } from '../lib/company-portal';

test(
  'drafts and submission lifecycle in an isolated local schema',
  {
    skip: !process.env.DATABASE_URL?.includes(
      'localhost:5432/jobx_company_local',
    ),
  },
  async (t) => {
    const original = process.env.DATABASE_URL!;
    const url = new URL(original);
    assert.equal(url.hostname, 'localhost');
    assert.equal(url.pathname, '/jobx_company_local');
    const schema = 'draft_test_' + randomUUID().replaceAll('-', '');
    const c = new Client({ connectionString: original });
    await c.connect();
    process.env.COMPANY_PORTAL_ENABLED = 'true';
    process.env.SESSION_SECRET =
      'local-draft-test-secret-longer-than-32-characters';
    process.env.INVOICE_EMAIL_ENABLED = 'false';
    try {
      await c.query(`CREATE SCHEMA ${schema}`);
      await c.query(`SET search_path TO ${schema}`);
      for (const file of readdirSync('db/migrations')
        .filter((f) => f.endsWith('.sql'))
        .sort())
        await c.query(readFileSync('db/migrations/' + file, 'utf8'));
      url.searchParams.set('options', '-c search_path=' + schema);
      process.env.DATABASE_URL = url.href;
      const { account } = await createCompanyAccount({
        name: 'Draft test company',
        username: 'draft-test-owner',
        email: 'draft@example.com',
        confirmed: true,
      });
      await db().query(
        'UPDATE company_accounts SET must_change_password=false,representative_name=$2 WHERE id=$1',
        [account.id, 'ტესტ ავტორი'],
      );
      const row = (
        await db().query('SELECT * FROM company_accounts WHERE id=$1', [
          account.id,
        ])
      ).rows[0];
      const company: CompanyIdentity = {
        id: row.id,
        companyKey: row.company_key,
        name: 'Draft test company',
        username: row.username,
        email: row.email,
        mustChangePassword: false,
        role: 'owner',
        approvalStatus: 'approved',
        emailVerified: true,
        representativeName: 'ტესტ ავტორი',
      };
      const other = { ...company, companyKey: 'other-company' };
      const id = randomUUID();
      await t.test(
        'save update list get and delete incomplete drafts',
        async () => {
          await save(company, { id, form: { title: '' }, step: 1 });
          assert.equal((await get(company, id)).step, 1);
          await save(company, {
            id,
            form: { title: 'ახალი სათაური' },
            step: 3,
          });
          const rows = await list(company);
          assert.equal(rows[0].title, 'ახალი სათაური');
          assert.equal(rows[0].updatedBy, 'ტესტ ავტორი');
          assert.equal(rows[0].step, 3);
          assert.equal((await list({ ...company, role: 'viewer' })).length, 1);
        },
      );
      await t.test(
        'other company get save delete are 404 and viewers cannot write',
        async () => {
          for (const op of [
            () => get(other, id),
            () => save(other, { id, form: {}, step: 1 }),
            () => remove(other, id),
          ])
            await assert.rejects(op, { status: 404 });
          for (const op of [
            () =>
              save({ ...company, role: 'viewer' }, { id, form: {}, step: 1 }),
            () => remove({ ...company, role: 'viewer' }, id),
          ])
            await assert.rejects(op, { status: 403 });
          await remove(company, id);
          assert.equal((await list(company)).length, 0);
        },
      );
      await t.test(
        '20 new drafts allowed, concurrent 21st rejected, updates allowed',
        async () => {
          const ids = Array.from({ length: 21 }, () => randomUUID());
          const results = await Promise.allSettled(
            ids.map((id) => save(company, { id, form: {}, step: 1 })),
          );
          assert.equal(
            results.filter((r) => r.status === 'fulfilled').length,
            20,
          );
          const rejected = results.find((r) => r.status === 'rejected');
          assert.equal(
            rejected?.status === 'rejected' && rejected.reason.status,
            409,
          );
          const existing = (await list(company))[0];
          await save(company, {
            id: existing.id,
            form: { title: 'განახლება' },
            step: 2,
          });
          for (const draft of await list(company))
            await remove(company, draft.id);
        },
      );
      await t.test(
        'oversize, unknown keys and overlong strings refused; unfinished questions allowed',
        async () => {
          await assert.rejects(
            () =>
              save(company, {
                id: randomUUID(),
                form: { description: 'x'.repeat(65537) },
                step: 1,
              }),
            /დიდია/,
          );
          await assert.rejects(() =>
            save(company, {
              id: randomUUID(),
              form: { title: 'x'.repeat(121) },
              step: 1,
            }),
          );
          await assert.rejects(() =>
            save(company, {
              id: randomUUID(),
              form: { unknown: 'x' },
              step: 1,
            }),
          );
          const unfinished = await save(company, {
            id: randomUUID(),
            form: {
              questions: [{ text: '' }],
              languages: [{ name: '', level: '' }],
            },
            step: 3,
          });
          await remove(company, unfinished.id);
        },
      );
      const form = {
        ...newCompanyJob(),
        title: 'კონსულტანტი',
        description: 'მომხმარებელთან ურთიერთობა და პროდუქციის წარდგენა.',
        contact: 'hr@example.com',
        deadline: submissionDate(new Date(Date.now() + 20 * 86400000)),
        experience: '1–3 წელი' as const,
        languages: [{ name: 'ინგლისური' as const, level: 'B2' as const }],
      };
      let jobId = '';
      await t.test(
        'create deletes draft and identical request retries make one job',
        async () => {
          const draftId = randomUUID();
          await save(company, { id: draftId, form, step: 4 });
          const request = {
            action: 'create',
            requestId: draftId,
            draftId,
            form,
          };
          const created = await changeCompanyJob(company, request);
          assert.ok('id' in created);
          jobId = created.id;
          await assert.rejects(() => get(company, draftId), { status: 404 });
          await changeCompanyJob(company, request);
          assert.equal((await companyJobs(company)).length, 1);
        },
      );
      await t.test(
        'job draft ownership, uniqueness, save deletion and native fact clearing',
        async () => {
          const draftId = randomUUID();
          await assert.rejects(
            () => save(other, { id: draftId, jobId, form, step: 1 }),
            { status: 404 },
          );
          await save(company, { id: draftId, jobId, form, step: 1 });
          assert.equal((await getForJob(company, jobId))?.id, draftId);
          assert.equal(await getForJob(other, jobId), null);
          await assert.rejects(
            () => save(company, { id: randomUUID(), jobId, form, step: 1 }),
            { status: 409 },
          );
          const current = (await companyJobs(company))[0];
          await changeCompanyJob(company, {
            action: 'save',
            id: jobId,
            version: current.version,
            draftId,
            form: { ...form, experience: '', languages: [] },
          });
          assert.equal(await getForJob(company, jobId), null);
          const stored = (
            await db().query('SELECT draft FROM jobs WHERE id=$1', [jobId])
          ).rows[0].draft;
          assert.ok(
            !stored.facts.some((f: { label: string }) =>
              ['გამოცდილება', 'ენები'].includes(f.label),
            ),
          );
        },
      );
      await t.test(
        'imported experience and languages remain unchanged on save',
        async () => {
          await db().query(
            `UPDATE jobs SET draft=jsonb_set(jsonb_set(draft,'{source}','"jobs.ge"'),'{facts}',$2::jsonb) WHERE id=$1`,
            [
              jobId,
              JSON.stringify([
                { label: 'გამოცდილება', value: '3–5 წელი' },
                { label: 'ენები', value: 'ფრანგული' },
              ]),
            ],
          );
          const current = (await companyJobs(company))[0];
          await changeCompanyJob(company, {
            action: 'save',
            id: jobId,
            version: current.version,
            form,
          });
          const stored = (
            await db().query('SELECT draft FROM jobs WHERE id=$1', [jobId])
          ).rows[0].draft;
          assert.equal(
            stored.facts.find(
              (f: { label: string }) => f.label === 'გამოცდილება',
            ).value,
            '3–5 წელი',
          );
          assert.equal(
            stored.facts.find((f: { label: string }) => f.label === 'ენები')
              .value,
            'ფრანგული',
          );
        },
      );
      await t.test(
        'restore deletes the draft only after successful mutation',
        async () => {
          const draftId = randomUUID();
          await save(company, { id: draftId, jobId, form, step: 4 });
          const current = (await companyJobs(company))[0];
          await assert.rejects(() =>
            changeCompanyJob(company, {
              action: 'save',
              id: jobId,
              version: current.version + 1,
              draftId,
              form,
            }),
          );
          assert.equal((await get(company, draftId)).id, draftId);
          await changeCompanyJob(company, {
            action: 'archive',
            id: jobId,
            version: current.version,
          });
          const archived = (await companyJobs(company))[0];
          await changeCompanyJob(company, {
            action: 'restore',
            id: jobId,
            version: archived.version,
            draftId,
            form,
          });
          assert.equal(await getForJob(company, jobId), null);
        },
      );
    } finally {
      await db().end();
      delete (globalThis as unknown as { ertadPool?: unknown }).ertadPool;
      process.env.DATABASE_URL = original;
      await c.query(`DROP SCHEMA ${schema} CASCADE`);
      await c.end();
    }
  },
);
