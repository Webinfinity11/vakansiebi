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
      {
        title: 'სუპერვაიზერი',
        company: 'მაღაზია',
        city: 'ვაკე, ჭავჭავაძის 74გ',
      },
      {
        title: 'სესხის ოფიცერი',
        company: 'ბანკი',
        city: 'საქართველოს მასშტაბით',
      },
      {
        title: 'ოპერატორი',
        company: 'კომპანია',
        city: 'საქართველო',
        description: 'სამუშაო ადგილი: ქ. ბათუმი.',
      },
      { title: 'მოლარე', company: 'მაღაზია', city: 'რუსთავი' },
      {
        title: 'კონტენტკრეატორი',
        description: 'სამუშაო გრაფიკი: შეთანხმებით (ნახევარ განაკვეთზე)',
      },
      {
        title: 'გუნდის წევრი',
        employmentType: 'სრული განაკვეთი',
        description: 'სრული ან ნახევარი განაკვეთი (თქვენი სურვილისამებრ).',
      },
      {
        title: 'გრაფიკული დიზაინერი/ადმინისტრატორი',
        description:
          'ნახევარი განაკვეთი დაეთმობა გრაფიკას ხოლო დღის მეორე ნახევარი საიტის ადმინისტრირებას.',
      },
      {
        title: 'საოფისე აგენტი',
        description: 'სამუშაო გრაფიკი: ნახევარი განაკვეთი არ განიხილება.',
      },
      {
        title: 'იურისტი',
        description: 'Work Hours: Part-time, 20-30 hrs. per week',
      },
      {
        title: 'გამოცდილი თანამშრომელი',
        description:
          'მინიმუმ 2 წელი ნახევარ განაკვეთზე მუშაობის გამოცდილება. სამუშაო გრაფიკი: სრული განაკვეთი.',
      },
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
        rustavi.jobs.map((job) => job.city).sort((a, b) => a.localeCompare(b)),
        ['რუსთავი', 'საქართველოს მასშტაბით'],
        'a Tbilisi street named after Rustavi is not Rustavi; a nationwide posting is everywhere',
      );
      const inCity = async (city: string) =>
        (
          await publicJobs(new URLSearchParams({ ids: ids.join(','), city }))
        ).jobs
          .map((job) => job.title)
          .sort((a, b) => a.localeCompare(b));
      assert.ok(
        (await inCity('თბილისი')).includes('სუპერვაიზერი'),
        'a Tbilisi district is Tbilisi',
      );
      assert.ok(
        (await inCity('ბათუმი')).includes('ოპერატორი'),
        'a bare "Georgia" is read from the text like an empty city',
      );
      assert.ok(!(await inCity('სხვა')).includes('სუპერვაიზერი'));
      const tbilisi = await publicJobs(
        new URLSearchParams({
          ids: ids.join(','),
          city: 'თბილისი',
          q: 'მოლარე',
        }),
      );
      assert.equal(tbilisi.total, 1);
      const partTime = await publicJobs(
        new URLSearchParams({
          ids: ids.slice(12).join(','),
          employment: 'part-time',
        }),
      );
      assert.deepEqual(
        partTime.jobs
          .map((job) => job.title)
          .sort((a, b) => a.localeCompare(b)),
        ['კონტენტკრეატორი', 'გუნდის წევრი', 'იურისტი'].sort((a, b) =>
          a.localeCompare(b),
        ),
        'offered schedules in descriptions qualify, duty splits, unavailable schedules and past experience do not',
      );
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
