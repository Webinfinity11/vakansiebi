import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { db } from '../lib/server/db';
import { clearPublicJobsCache, publicJobs } from '../lib/server/jobs';
import type { Vacancy } from '../lib/types';

/* The complaints behind this file: a search for an occupation listed jobs whose employer
   carried the word (a pharmaceutical company's medical representatives for "ფარმაცევტი"),
   and a Tbilisi address on "რუსთავის გზატკეცილი" put a vacancy under Rustavi. */
void test(
  'occupations are read from the title, ordinary words still find employers, streets are not cities',
  { skip: process.env.RUN_DB_TESTS !== '1' },
  async () => {
    assert.equal(new URL(process.env.DATABASE_URL!).pathname, '/ertad_test');
    const today = new Date().toLocaleDateString('en-CA', {
      timeZone: 'Asia/Tbilisi',
    });
    const base: Vacancy = {
      title: '',
      company: '',
      city: 'თბილისი',
      category: 'სხვა',
      salary: '',
      salaryMin: null,
      currency: '',
      salaryPeriod: '',
      mode: '',
      description: 'სამუშაოს აღწერა.',
      url: 'https://www.hr.ge/announcement/9998890/test',
      source: 'hr.ge',
      deadline: '2099-01-01',
      datePosted: today,
      employmentType: '',
    };
    const fixtures: Partial<Vacancy>[] = [
      { title: 'ფარმაცევტი', company: 'აფთიაქი ჯი' },
      {
        title: 'სამედიცინო წარმომადგენელი',
        company: 'ფარმაცევტული კომპანია',
      },
      { title: 'მძღოლი-კურიერი', company: 'კონდიტერი' },
      { title: 'კონდიტერი', company: 'საცხობი' },
      { title: 'მიმტანი', company: 'სასტუმრო რივერსაიდი' },
      { title: 'გაყიდვების მენეჯერი', company: 'HR Georgia' },
      { title: 'HR მენეჯერი', company: 'კომპანია' },
      {
        title: 'მოლარე',
        company: 'მაღაზია',
        city: 'ქ. თბილისი, რუსთავის გზატკეცილი 24',
      },
      { title: 'მოლარე', company: 'მაღაზია', city: 'რუსთავი' },
    ];
    const ids = fixtures.map(() => randomUUID());
    try {
      for (let i = 0; i < ids.length; i++) {
        const v = { ...base, ...fixtures[i] };
        await db().query(
          "INSERT INTO jobs(id,draft,published,status,fingerprint,published_at) VALUES($1::uuid,$2,$2,'published',$1::text,now())",
          [ids[i], v],
        );
        await db().query(
          "INSERT INTO source_items(id,source_id,external_id,url,job_id,raw,last_checked_at) VALUES($1::uuid,'hr',$1::text,$2,$1::uuid,$3,now())",
          [ids[i], v.url + i, v],
        );
      }
      const titles = async (values: Record<string, string>) =>
        (
          await publicJobs(
            new URLSearchParams({ ids: ids.join(','), ...values }),
          )
        ).jobs
          .map((job) => job.title)
          .sort((a, b) => a.localeCompare(b));
      assert.deepEqual(await titles({ q: 'ფარმაცევტი' }), ['ფარმაცევტი']);
      assert.deepEqual(
        await titles({ q: 'კონდიტერი' }),
        ['კონდიტერი'],
        'an occupation in the employer name is not the job',
      );
      assert.deepEqual(await titles({ q: 'hr' }), ['HR მენეჯერი']);
      assert.deepEqual(
        await titles({ q: 'სასტუმრო' }),
        ['მიმტანი'],
        'a word that is not an occupation still finds the employer',
      );
      assert.deepEqual(await titles({ q: 'მძღოლი' }), ['მძღოლი-კურიერი']);
      const rustavi = await publicJobs(
        new URLSearchParams({ ids: ids.join(','), city: 'რუსთავი' }),
      );
      assert.deepEqual(
        rustavi.jobs.map((job) => job.city),
        ['რუსთავი'],
        'a Tbilisi street named after Rustavi is not Rustavi',
      );
      const tbilisi = await publicJobs(
        new URLSearchParams({
          ids: ids.join(','),
          city: 'თბილისი',
          q: 'მოლარე',
        }),
      );
      assert.equal(tbilisi.total, 1);
    } finally {
      clearPublicJobsCache();
      await db().query('DELETE FROM source_items WHERE id=ANY($1::uuid[])', [
        ids,
      ]);
      await db().query('DELETE FROM jobs WHERE id=ANY($1::uuid[])', [ids]);
      await db().end();
    }
  },
);
