import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { Client } from 'pg';
import { db } from '../lib/server/db';
import { saveCompany } from '../lib/server/companies';
import { publicJobs, clearPublicJobsCache } from '../lib/server/jobs';
import { companyKey } from '../lib/company-key';
import { jobPosting, siteUrl } from '../lib/seo';
import type { PublicJob } from '../lib/types';

const vacancy = {
  title: 'Logo regression accountant', company: 'Profile Logo Test',
  city: 'თბილისი', category: 'სხვა', salary: '', salaryMin: null,
  currency: '', salaryPeriod: '', mode: '',
  description: 'A meaningful vacancy description for the company profile logo regression.',
  url: 'https://www.hr.ge/announcement/9998811/test', source: 'hr.ge',
  deadline: '2099-01-01', datePosted: '2026-11-27', logoUrl: '',
};

test('JobPosting includes uploaded profile logos as absolute URLs', () => {
  const logoUrl = '/api/logos/' + 'a'.repeat(64);
  const data = jobPosting({ ...vacancy, id: randomUUID(), logoUrl } as PublicJob, '2026-11-27');
  assert.ok(data);
  assert.equal(data.hiringOrganization.logo, siteUrl + logoUrl);
});

test('profile logo wins by ownership or name, changes across warmed reads and removal restores snapshots',
  { skip: process.env.RUN_COMPANY_DB_TESTS !== '1' }, async () => {
    const original = process.env.DATABASE_URL!;
    const url = new URL(original);
    assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
    assert.equal(url.pathname, '/jobx_company_local');
    const schema = 'profile_logos_' + randomUUID().replaceAll('-', '');
    const client = new Client({ connectionString: original });
    await client.connect();
    try {
      await client.query(`CREATE SCHEMA ${schema}`);
      await client.query(`SET search_path TO ${schema}`);
      for (const file of readdirSync('db/migrations').filter(f => f.endsWith('.sql')).sort())
        await client.query(readFileSync('db/migrations/' + file, 'utf8'));
      await client.query("INSERT INTO sources(id,name) VALUES('hr','hr.ge') ON CONFLICT (id) DO NOTHING");
      url.searchParams.set('options', '-c search_path=' + schema);
      process.env.DATABASE_URL = url.href;
      const profile = { name: vacancy.company, logoUrl: 'https://example.com/first.png',
        website: '', description: '', version: 0 };
      let saved = await saveCompany(profile);
      const ids = [randomUUID(), randomUUID(), randomUUID()];
      const fallback = 'https://www.hr.ge/original-logo.png';
      for (const [index, id] of ids.entries()) {
        const snapshot = { ...vacancy, company: index === 0 ? vacancy.company : `Alternate legal name ${index}`,
          url: vacancy.url + '/' + id,
          logoUrl: index === 2 ? '' : fallback };
        await db().query("INSERT INTO jobs(id,draft,published,status,fingerprint,published_at) VALUES($1::uuid,$2,$2,'published',$1::text,now())", [id, snapshot]);
        await db().query("INSERT INTO source_items(id,source_id,external_id,url,job_id,raw,last_checked_at,last_verified_at) VALUES($1::uuid,'hr',$1::text,$2,$1::uuid,$3,now(),now())", [id, snapshot.url + '/' + id, snapshot]);
        if (index > 0) await db().query('INSERT INTO company_job_ownership(job_id,company_key) VALUES($1,$2)', [id, companyKey(profile.name)]);
      }
      // A filtered list uses the 45-second process cache; ids reads do not.
      const read = () => publicJobs(new URLSearchParams({ q: vacancy.title, summary: '1' }));
      const check = async (expected: string[]) => {
        const result = await read();
        for (const [index, id] of ids.entries())
          assert.equal(result.jobs.find(job => job.id === id)?.logoUrl, expected[index]);
      };
      await check(ids.map(() => profile.logoUrl));
      await check(ids.map(() => profile.logoUrl));
      saved = await saveCompany({ ...saved, logoUrl: 'https://example.com/second.png' });
      await check(ids.map(() => saved.logoUrl));
      await saveCompany({ ...saved, logoUrl: '' });
      // With no snapshot or same-name donor, removal restores the placeholder.
      await check([fallback, fallback, '']);
    } finally {
      clearPublicJobsCache();
      await db().end();
      delete (globalThis as unknown as { ertadPool?: unknown }).ertadPool;
      process.env.DATABASE_URL = original;
      await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await client.end();
    }
  });
