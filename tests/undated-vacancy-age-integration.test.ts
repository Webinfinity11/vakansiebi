import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { db } from '../lib/server/db';
import { clearPublicJobsCache, publicJobs } from '../lib/server/jobs';
import { undatedVacancyDays } from '../lib/server/search-plan';
import type { Vacancy } from '../lib/types';

/* Boards without a removal sweep never say when an undated ad is gone; on
   2026-11-27 ads first posted in 2020 were still listed as open. */
void test(
  'a vacancy without a deadline stays public only for its first 30 days',
  { skip: process.env.RUN_DB_TESTS !== '1' },
  async () => {
    assert.equal(new URL(process.env.DATABASE_URL!).pathname, '/ertad_test');
    const day = (offset: number) =>
      new Date(Date.now() - offset * 86400000).toLocaleDateString('en-CA', {
        timeZone: 'Asia/Tbilisi',
      });
    const base: Vacancy = {
      title: 'Undated fixture',
      company: '',
      city: 'თბილისი',
      category: 'სხვა',
      salary: '',
      salaryMin: null,
      currency: '',
      salaryPeriod: '',
      mode: '',
      description: 'An ad from a classified board that gives no deadline.',
      url: 'https://gancxadebebi.ge/test',
      source: 'gancxadebebi.ge',
      deadline: '',
      datePosted: day(0),
      employmentType: '',
    };
    const cases: { name: string; patch: Partial<Vacancy>; open: boolean }[] = [
      { name: 'posted today', patch: { datePosted: day(0) }, open: true },
      { name: 'posted on the last open day', patch: { datePosted: day(undatedVacancyDays) }, open: true },
      { name: 'posted a day too early', patch: { datePosted: day(undatedVacancyDays + 1) }, open: false },
      { name: 'posted in 2020', patch: { datePosted: '2020-03-23' }, open: false },
      // No posting date: the record's own import date decides.
      { name: 'no posting date, imported today', patch: { datePosted: '' }, open: true },
      // A deadline still wins over the posting date.
      { name: 'old post with a live deadline', patch: { datePosted: '2020-03-23', deadline: '2099-01-01' }, open: true },
    ];
    const ids = cases.map(() => randomUUID());
    try {
      for (let i = 0; i < cases.length; i++) {
        const v = { ...base, ...cases[i].patch, title: `${base.title} ${i}` };
        await db().query(
          "INSERT INTO jobs(id,draft,published,status,fingerprint,published_at) VALUES($1::uuid,$2,$2,'published',$1::text,now())",
          [ids[i], v],
        );
        await db().query(
          "INSERT INTO source_items(id,source_id,external_id,url,job_id,raw,last_checked_at) VALUES($1::uuid,'hr',$1::text,$2,$1::uuid,$3,now())",
          [ids[i], v.url, v],
        );
      }
      clearPublicJobsCache();
      const result = await publicJobs(new URLSearchParams({ ids: ids.join(',') }));
      const shown = new Set(result.jobs.map((job) => job.id));
      for (let i = 0; i < cases.length; i++)
        assert.equal(shown.has(ids[i]), cases[i].open, cases[i].name);
    } finally {
      clearPublicJobsCache();
      await db().query('DELETE FROM source_items WHERE id=ANY($1::uuid[])', [ids]);
      await db().query('DELETE FROM jobs WHERE id=ANY($1::uuid[])', [ids]);
      await db().end();
    }
  },
);
