import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { db } from '../lib/server/db';
import { publicJobs } from '../lib/server/jobs';
import type { Vacancy } from '../lib/types';
import { similarVacancies } from '../lib/server/similar-vacancies';
void test(
  'search aliases, conditional counts, recovery and daily filters use actual public snapshots',
  { skip: process.env.RUN_DB_TESTS !== '1' },
  async () => {
    assert.equal(new URL(process.env.DATABASE_URL!).pathname, '/ertad_test');
    const today = new Date().toLocaleDateString('en-CA', {
      timeZone: 'Asia/Tbilisi',
    });
    const base: Vacancy = {
      title: 'Developer',
      company: 'Search fixture',
      city: 'თბილისი',
      category: 'ტექნოლოგიები',
      salary: '2000 ლარი / თვე',
      salaryMin: 2000,
      currency: 'GEL',
      salaryPeriod: 'თვე',
      mode: '',
      description:
        'Work with our development team. Previous professional experience is required.',
      url: 'https://www.hr.ge/announcement/9998881/test',
      source: 'hr.ge',
      deadline: '2099-01-01',
      datePosted: today,
      employmentType: 'სრული განაკვეთი',
    };
    const fixtures: Partial<Vacancy>[] = [
      {},
      {
        title: 'ბუღალტერი',
        category: 'ფინანსები',
        employmentType: 'ნახევარი განაკვეთი',
        description:
          'გამოცდილება არ არის სავალდებულო. შეასრულეთ საბუღალტრო ოპერაციები ჩვენს გუნდთან ერთად.',
      },
      {
        title: 'დღიური სამუშაო — დამხმარე',
        category: 'სხვა',
        salary: '100 ლარი / დღე',
        salaryMin: 100,
        salaryPeriod: 'დღე',
      },
      {
        title: 'მუდმივი მზარეული',
        category: 'მომსახურება',
        salary: '120 ლარი / დღე',
        salaryMin: 120,
        salaryPeriod: 'დღე',
        description:
          'ყოველდღიური სამუშაო პროცესი მოიცავს კერძების მომზადებას. გვჭირდება გამოცდილი მზარეული.',
      },
      {
        title: 'სტაჟიორი დეველოპერი',
        salary: '',
        salaryMin: null,
        currency: '',
        salaryPeriod: '',
        employmentType: 'სტაჟირება',
        description:
          'No prior experience required. Learn alongside our professional development team.',
      },
      {
        title: 'Accountant',
        city: 'ბათუმი',
        category: 'ფინანსები',
        datePosted: '2020-01-01',
      },
      { title: 'Developer future', datePosted: '2098-01-01' },
      { title: 'Developer expired', deadline: '2020-01-01' },
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
          [ids[i], v.url, v],
        );
      }
      const search = (values: Record<string, string> = {}) =>
        publicJobs(new URLSearchParams({ ids: ids.join(','), ...values }));
      assert.equal(
        (await search()).total,
        7,
        'expired postings excluded from results and counts',
      );
      assert.equal((await search({ q: 'ბუღალტერია' })).total, 2);
      assert.equal((await search({ q: 'დეველოპერი' })).total, 3);
      assert.equal(
        (await search({ q: 'develoepr' })).search.suggestion?.query,
        'developer',
      );
      assert.equal(
        (await search({ q: 'develoepr' })).search.suggestion?.count,
        3,
      );
      assert.equal((await search({ q: 'C++' })).search.suggestion, null);
      assert.equal((await search({ employment: 'part-time' })).total, 1);
      assert.equal(
        (await search({ employment: 'internship', entryLevel: 'true' })).total,
        1,
      );
      assert.equal(
        (await search({ entryLevel: 'true' })).total,
        2,
        'required experience must not qualify',
      );
      await db().query(
        "UPDATE jobs SET published=jsonb_set(published,'{description}',to_jsonb($2::text)) WHERE id=$1",
        [ids[1], 'გამოცდილების გარეშე. უნდა ქონდეს გამოცდილება.'],
      );
      assert.equal(
        (await search({ entryLevel: 'true' })).total,
        1,
        'contradictory entry-level labels are not promoted as no-experience jobs',
      );
      await db().query(
        "UPDATE jobs SET published=jsonb_set(published,'{description}',to_jsonb($2::text)) WHERE id=$1",
        [ids[1], fixtures[1].description],
      );
      assert.equal(
        (await search({ salaryFrom: '1000', salaryTo: '2500' })).total,
        4,
        'unknown and daily salaries cannot enter monthly range',
      );
      assert.equal((await search({ salaryPeriod: 'day' })).total, 2);
      assert.equal(
        (await search({ salaryPeriod: 'day', salaryFrom: '110' })).jobs[0]
          .title,
        'მუდმივი მზარეული',
      );
      assert.equal(
        (await search({ employment: 'daily' })).total,
        1,
        'daily wages/everyday duties do not imply one-day employment',
      );
      assert.equal(
        (await search({ salaryFrom: '3000', salaryTo: '1000' })).total,
        0,
        'inverted range is never silently changed',
      );
      assert.equal(
        (await search({ postedWithin: '1' })).total,
        5,
        'source date, not import date; future/old excluded',
      );
      const facets = await search({ city: 'ბათუმი', category: 'ტექნოლოგიები' });
      assert.equal(facets.total, 0);
      assert.equal(facets.search.categoryTotal, 1);
      assert.deepEqual(facets.search.categories, [
        { name: 'ფინანსები', count: 1 },
      ]);
      assert.ok(
        facets.search.relaxations.some(
          (r) => r.key === 'category' && r.count === 1,
        ),
      );
      const compact = await search({ countsOnly: '1' });
      assert.equal(compact.total, 7);
      assert.deepEqual(compact.jobs, []);
      assert.equal((await search({ q: "' OR 1=1 --" })).total, 0);
      assert.equal((await search({ ids: 'not-a-uuid' })).total, 0);
      const hidden = await search({ exclude: ids[0] + ',bad' });
      assert.equal(hidden.total, 6);
      assert.ok(!hidden.jobs.some((job) => job.id === ids[0]));
      assert.equal(
        (await search({ exclude: ids[0], countsOnly: '1' })).total,
        6,
      );
      const original = (await search({ ids: ids[0] })).jobs[0];
      const similar = await similarVacancies(original, ids[4]);
      assert.ok(
        similar.every(
          ({ job }) => !new Set<string>([ids[0], ids[4], ids[7]]).has(job.id),
        ),
      );
      assert.ok(similar.some(({ job }) => job.id === ids[6]));
    } finally {
      await db().query('DELETE FROM source_items WHERE id=ANY($1::uuid[])', [
        ids,
      ]);
      await db().query('DELETE FROM jobs WHERE id=ANY($1::uuid[])', [ids]);
      await db().end();
    }
  },
);
