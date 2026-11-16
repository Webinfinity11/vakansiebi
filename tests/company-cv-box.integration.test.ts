import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PDFDocument, StandardFonts } from 'pdf-lib';

void test(
  'CV box is opt-in, requires consent and a reachable company; private uploads are deduplicated',
  { skip: process.env.RUN_COMPANY_DB_TESTS !== '1' },
  async () => {
    const url = new URL(process.env.DATABASE_URL!);
    assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
    assert.equal(url.pathname, '/jobx_company_local');
    const { db } = await import('../lib/server/db');
    const { cvBoxCompany, submitCvBox } =
      await import('../lib/server/company-cv-box');
    const { companyCandidates, candidateCv } =
      await import('../lib/server/company-candidates');
    const savedEnabled = process.env.COMPANY_PORTAL_ENABLED;
    const key = 'cvboxqa' + randomUUID().replaceAll('-', '');
    const account = randomUUID();
    const owner = {
      id: account,
      companyKey: key,
      name: 'CV box QA',
      username: key,
      email: key + '@example.com',
      mustChangePassword: false,
      role: 'owner' as const,
      approvalStatus: 'approved' as const,
      emailVerified: true,
      representativeName: 'QA',
    };
    const pdf = await PDFDocument.create();
    const page = pdf.addPage();
    page.drawText('Candidate QA - Excel', {
      font: await pdf.embedFont(StandardFonts.Helvetica),
    });
    const bytes = Uint8Array.from(await pdf.save()).buffer;
    const form = (email = 'candidate@example.com') => {
      const data = new FormData();
      data.set('company', key);
      data.set('name', 'Candidate QA');
      data.set('email', email);
      data.set('consent', 'on');
      data.set(
        'file',
        new File([bytes], 'QA.pdf', { type: 'application/pdf' }),
      );
      return data;
    };
    try {
      process.env.COMPANY_PORTAL_ENABLED = 'true';
      await db().query(
        'INSERT INTO company_profiles(company_key,name) VALUES($1,$2)',
        [key, owner.name],
      );
      assert.equal(await cvBoxCompany([key]), null);
      await db().query(
        'UPDATE company_profiles SET cv_box_enabled=true WHERE company_key=$1',
        [key],
      );
      assert.equal(await cvBoxCompany([key]), null, 'no receiving account');
      await db().query(
        'INSERT INTO company_accounts(id,company_key,username,email,password_hash,must_change_password) VALUES($1,$2,$2,$3,$4,false)',
        [account, key, owner.email, 'unused-qa-hash'],
      );
      assert.equal((await cvBoxCompany([key]))?.company_key, key);
      const noConsent = form();
      noConsent.delete('consent');
      await assert.rejects(submitCvBox(noConsent, key), /თანხმობა/);
      const fake = form();
      fake.set('file', new File(['hello'], 'fake.docx'));
      await assert.rejects(submitCvBox(fake, key), /PDF|Word/);
      const result = await submitCvBox(form(), key);
      assert.equal(result.duplicate, false);
      assert.equal((await submitCvBox(form(), key)).duplicate, true);
      const row = (
        await db().query(
          'SELECT source,job_id,consent_at,content,blob_path FROM company_cv_uploads WHERE company_key=$1',
          [key],
        )
      ).rows[0];
      assert.equal(row.source, 'cv_box');
      assert.equal(row.job_id, null);
      assert.ok(row.consent_at);
      assert.ok(row.content);
      assert.equal(row.blob_path, null);
      const candidates = await companyCandidates(owner);
      assert.equal(candidates.length, 1);
      assert.equal(candidates[0].source, 'cv_box');
      assert.ok(candidates[0].profile?.text.includes('Excel'));
      const file = await candidateCv(owner, result.entry);
      assert.equal(file?.type, 'application/pdf');
      await assert.rejects(
        candidateCv({ ...owner, companyKey: key + 'other' }, result.entry),
        /ვერ მოიძებნა/,
      );
      await db().query(
        'UPDATE company_accounts SET enabled=false WHERE id=$1',
        [account],
      );
      assert.equal(await cvBoxCompany([key]), null);
      await assert.rejects(submitCvBox(form(), key), /არ იღებს/);
      process.env.COMPANY_PORTAL_ENABLED = 'false';
      assert.equal(await cvBoxCompany([key]), null);
    } finally {
      if (savedEnabled === undefined) delete process.env.COMPANY_PORTAL_ENABLED;
      else process.env.COMPANY_PORTAL_ENABLED = savedEnabled;
      await db().query('DELETE FROM company_cv_profiles WHERE company_key=$1', [
        key,
      ]);
      await db().query('DELETE FROM company_accounts WHERE company_key=$1', [
        key,
      ]);
      await db().query('DELETE FROM company_profiles WHERE company_key=$1', [
        key,
      ]);
      await db().end();
    }
  },
);
