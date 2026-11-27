import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { db } from '../lib/server/db';
import { clearPublicJobsCache, publicJobs } from '../lib/server/jobs';
import type { Vacancy } from '../lib/types';

/* joob.ge reposts one ad under a new id. With no employer name such postings were
   never grouped, so every repost became its own public page (migration 096). */
void test(
  'identical postings without an employer fold into the newest one',
  { skip: process.env.RUN_DB_TESTS !== '1' },
  async () => {
    assert.equal(new URL(process.env.DATABASE_URL!).pathname, '/ertad_test');
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tbilisi' });
    const marker = 'zqrepost' + randomUUID().slice(0, 8);
    const base: Vacancy = {
      title: 'C კატეგორია მძღოლი გვჭირდება',
      company: '',
      city: 'თბილისი',
      category: 'სხვა',
      salary: '',
      salaryMin: null,
      currency: '',
      salaryPeriod: '',
      mode: '',
      description: `ვეძებთ C კატეგორიის მძღოლს. ${marker}`,
      url: 'https://joob.ge/?p=1',
      source: 'joob.ge',
      deadline: '2099-01-01',
      datePosted: today,
      employmentType: '',
    };
    const rows: Partial<Vacancy>[] = [
      { url: 'https://joob.ge/?p=1' },
      // The repost: the same text, the description spaced and cased differently.
      { url: 'https://joob.ge/?p=2', description: `ვეძებთ  C კატეგორიის მძღოლს.\n${marker.toUpperCase()}` },
      // Same title, another employer's text: a different posting.
      { url: 'https://joob.ge/?p=3', description: `საჭიროა მძღოლი სამშენებლო კომპანიაში. ${marker}` },
    ];
    const ids = rows.map(() => randomUUID());
    try {
      for (let i = 0; i < rows.length; i++) {
        const v = { ...base, ...rows[i] };
        await db().query(
          "INSERT INTO jobs(id,draft,published,status,fingerprint,published_at) VALUES($1::uuid,$2,$2,'published',$3,now()+($4||' seconds')::interval)",
          [ids[i], v, `fixture|${v.url}`, i],
        );
        await db().query(
          "INSERT INTO source_items(id,source_id,external_id,url,job_id,raw,last_checked_at) VALUES($1::uuid,'hr',$1::text,$2,$1::uuid,$3,now())",
          [ids[i], v.url, v],
        );
      }
      clearPublicJobsCache();
      const list = await publicJobs(new URLSearchParams({ q: marker }));
      assert.deepEqual(new Set(list.jobs.map((job) => job.id)), new Set([ids[1], ids[2]]), 'the newest repost and the other ad are listed');
      clearPublicJobsCache();
      const older = await publicJobs(new URLSearchParams({ ids: ids[0] }));
      assert.equal(older.total, 1, 'the older repost still opens');
      assert.equal(older.jobs[0].canonicalId, ids[1], 'and names the newest repost as canonical');
      clearPublicJobsCache();
      const other = await publicJobs(new URLSearchParams({ ids: ids[2] }));
      assert.equal(other.jobs[0].canonicalId, ids[2], 'a different text stays its own page');
    } finally {
      clearPublicJobsCache();
      await db().query('DELETE FROM source_items WHERE id=ANY($1::uuid[])', [ids]);
      await db().query('DELETE FROM jobs WHERE id=ANY($1::uuid[])', [ids]);
      await db().end();
    }
  },
);
