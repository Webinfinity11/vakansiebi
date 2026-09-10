import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  logoCompanyKey,
  officialCompanyLogo,
} from '../lib/company-logo-identity';
import { db } from '../lib/server/db';
import { publicJobs } from '../lib/server/jobs';
import { companyKey } from '../lib/company-key';
void test('logo identity uses exact normalized company names and rejects generic or partial brand names', () => {
  assert.equal(logoCompanyKey('შპს „ნოვა“'), logoCompanyKey('ნოვა'));
  assert.equal(logoCompanyKey('Acme, LLC'), logoCompanyKey('ACME'));
  assert.equal(logoCompanyKey('კომპანია'), '');
  assert.equal(logoCompanyKey('ABC中文'), '');
  assert.ok(officialCompanyLogo('JSC Bank of Georgia'));
  assert.ok(officialCompanyLogo('სს საქართველოს ბანკი'));
  assert.equal(officialCompanyLogo('საქართველოს ბანკის პარტნიორი'), null);
});
void test(
  'missing logos reuse verified active donor snapshots, never drafts, stale data or quality-held logos',
  { skip: process.env.RUN_DB_TESTS !== '1' },
  async () => {
    assert.equal(new URL(process.env.DATABASE_URL!).pathname, '/ertad_test');
    const donor = randomUUID(),
      target = randomUUID();
    const name = 'Logo Studio ' + randomUUID();
    const targetName = 'შპს „' + name + '“';
    const logo = 'https://static.ss.ge/20260910/company-test.png';
    const v = {
      title: 'Company logo integration test',
      company: name,
      city: 'თბილისი',
      category: 'სხვა',
      salary: '',
      salaryMin: null,
      currency: '',
      salaryPeriod: '',
      mode: '',
      description:
        'A meaningful test description for this isolated company logo integration test.',
      url: 'https://www.hr.ge/announcement/9998811/test',
      source: 'hr.ge',
      deadline: '2099-01-01',
      datePosted: '2026-09-10',
      logoUrl: logo,
    };
    try {
      for (const id of [donor, target]) {
        const data =
          id === donor ? v : { ...v, company: targetName, logoUrl: '' };
        await db().query(
          "INSERT INTO jobs(id,draft,published,status,fingerprint,published_at) VALUES($1::uuid,$2,$2,'published',$1::text,now())",
          [id, data],
        );
        await db().query(
          "INSERT INTO source_items(id,source_id,external_id,url,job_id,raw,last_checked_at,last_verified_at) VALUES($1::uuid,'hr',$1::text,$2,$1::uuid,$3,now(),now())",
          [id, data.url, data],
        );
      }
      const read = async () =>
        (await publicJobs(new URLSearchParams({ ids: target }))).jobs[0];
      assert.equal((await read()).logoUrl, logo);
      assert.equal((await read()).logoOrigin, v.url);
      await db().query(
        "UPDATE source_items SET last_verified_at=now()-interval '8 days' WHERE id=$1",
        [donor],
      );
      assert.equal((await read()).logoUrl, '');
      await db().query(
        "UPDATE source_items SET last_verified_at=now(),quality_warning='Suspicious logo' WHERE id=$1",
        [donor],
      );
      assert.equal((await read()).logoUrl, '');
      await db().query(
        'UPDATE source_items SET quality_warning=NULL WHERE id=$1',
        [donor],
      );
      await db().query("UPDATE jobs SET status='pending' WHERE id=$1", [donor]);
      assert.equal((await read()).logoUrl, '');
      await db().query("UPDATE jobs SET status='published' WHERE id=$1", [
        donor,
      ]);
      const own = 'https://www.hr.ge/own-logo.png';
      await db().query(
        "UPDATE jobs SET published=jsonb_set(published,'{logoUrl}',to_jsonb($2::text)) WHERE id=$1",
        [target, own],
      );
      assert.equal(
        (await read()).logoUrl,
        own,
        'direct vacancy logo remains preferred',
      );
      await db().query(
        "INSERT INTO company_profiles(company_key,name,logo_url) VALUES($1,$2,'https://example.com/approved.png')",
        [companyKey(targetName), targetName],
      );
      assert.equal(
        (await read()).logoUrl,
        'https://example.com/approved.png',
        'explicit admin profile has priority',
      );
    } finally {
      await db().query('DELETE FROM company_profiles WHERE company_key=$1', [
        companyKey(targetName),
      ]);
      await db().query('DELETE FROM source_items WHERE id=ANY($1::uuid[])', [
        [donor, target],
      ]);
      await db().query('DELETE FROM jobs WHERE id=ANY($1::uuid[])', [
        [donor, target],
      ]);
      await db().end();
    }
  },
);
