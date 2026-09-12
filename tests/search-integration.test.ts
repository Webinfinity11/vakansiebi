import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { db } from '../lib/server/db';
import { publicJobs } from '../lib/server/jobs';
import type { Vacancy } from '../lib/types';
import { similarVacancies } from '../lib/server/similar-vacancies';
import { fingerprint } from '../worker/adapters';
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
    // A second set exercises the public listing without an ids restriction:
    // duplicate folding, empty salary periods, remote titles, unlisted and
    // missing cities, and unusable source dates.
    const marker = 'zqlisting' + randomUUID().slice(0, 8);
    const listing: Partial<Vacancy>[] = [
      {
        title: 'Warehouse Lead',
        company: 'Listing fixture',
        salary: '2500 ლარი',
        salaryMin: 2500,
        salaryPeriod: '',
        datePosted: '0001-01-01',
        source: 'hr.ge',
      },
      {
        title: 'Warehouse Lead',
        company: 'Listing fixture',
        salary: '2500',
        salaryMin: 2500,
        salaryPeriod: '',
        source: 'jobs.ge',
        url: 'https://jobs.ge/ge/?view=jobs&id=9998882',
      },
      {
        title: 'დისტანციური მხარდაჭერა',
        company: 'Listing fixture',
        city: 'მარნეული',
        salary: '',
        salaryMin: null,
        currency: '',
        salaryPeriod: '',
        datePosted: '',
      },
      {
        title: 'Field Agent',
        company: 'Listing fixture',
        city: '',
        mode: 'სამუშაო სახლიდან',
        salary: '',
        salaryMin: null,
        currency: '',
        salaryPeriod: '',
        description: 'სამუშაო ადგილი თბილისში, კატეგორია: მომსახურება.',
      },
      {
        title: 'Hourly helper',
        company: 'Listing fixture',
        salary: '8 ლარი საათში',
        salaryMin: 8,
        salaryPeriod: '',
      },
      {
        title: 'Warehouse Lead',
        company: '',
        salary: '',
        salaryMin: null,
        currency: '',
        salaryPeriod: '',
      },
      {
        title: 'Warehouse Lead',
        company: '',
        salary: '',
        salaryMin: null,
        currency: '',
        salaryPeriod: '',
      },
    ];
    const listingIds = listing.map(() => randomUUID());
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

      for (let i = 0; i < listingIds.length; i++) {
        const v = {
          ...base,
          ...listing[i],
          description: `${listing[i].description || base.description} ${marker}`,
        };
        // The import fingerprint, as the crawler computes it: duplicates from two boards
        // share it, which is what lets a lookup by id find the row it was folded into.
        await db().query(
          "INSERT INTO jobs(id,draft,published,status,fingerprint,published_at) VALUES($1::uuid,$2,$2,'published',$3,now()+($4||' seconds')::interval)",
          [listingIds[i], v, fingerprint(v as Vacancy), i],
        );
        await db().query(
          'INSERT INTO source_items(id,source_id,external_id,url,job_id,raw,last_checked_at) VALUES($1::uuid,$2,$1::text,$3,$1::uuid,$4,now())',
          [listingIds[i], v.source === 'jobs.ge' ? 'jobs' : 'hr', v.url, v],
        );
      }
      const list = (values: Record<string, string> = {}) =>
        publicJobs(new URLSearchParams({ q: marker, ...values }));
      const grouped = await list();
      assert.equal(
        grouped.total,
        6,
        'identical title, employer and city fold into one row; classifieds without an employer never do',
      );
      const kept = grouped.jobs.find((job) => job.id === listingIds[1]);
      assert.ok(kept, 'the most recently published duplicate is the one shown');
      assert.ok(!grouped.jobs.some((job) => job.id === listingIds[0]));
      assert.deepEqual(
        kept.sources.map((source: { source: string }) => source.source).sort(),
        ['hr.ge', 'jobs.ge'],
        'the folded posting keeps every original link',
      );
      assert.equal(
        grouped.search.categoryTotal,
        6,
        'facets count the grouped set',
      );
      const folded = await publicJobs(
        new URLSearchParams({ ids: listingIds[0] }),
      );
      assert.equal(folded.total, 1, 'a folded id still opens on its own');
      assert.equal(folded.jobs[0].sources.length, 2);
      assert.equal(
        (await list({ salaryFrom: '2000' })).total,
        1,
        'an empty period is an ordinary monthly figure',
      );
      assert.equal(
        (await list({ salaryFrom: '2000', source: 'hr.ge' })).total,
        1,
        'a folded source still satisfies the source filter',
      );
      assert.equal(
        (await list({ salaryFrom: '1', salaryTo: '100' })).total,
        0,
        'an hourly figure without a period never enters the monthly range',
      );
      assert.equal((await list({ sort: 'salary' })).jobs[0].id, listingIds[1]);
      assert.equal(
        (await list({ remote: 'true' })).total,
        2,
        'a remote title or a work-from-home mode both count as remote',
      );
      assert.equal(
        (await list({ city: 'სხვა' })).total,
        1,
        'other means a city outside the offered list',
      );
      assert.equal(
        (await list({ city: 'თბილისი' })).total,
        4,
        'a missing city falls back to the city named in the text',
      );
      assert.equal(
        (await list({ postedWithin: '1' })).total,
        6,
        'unusable source dates fall back to our publication day',
      );
      assert.equal((await list({ q: marker + ' lead' })).total, 3);
      assert.equal(
        (await list({ q: marker + ' lea' })).total,
        0,
        'short Latin terms match whole words only',
      );
      assert.equal(
        (await list({ q: marker + ' ის' })).total,
        6,
        'a two-letter particle beside other words is ignored',
      );
      assert.equal((await list({ q: marker + ' Listing fixture' })).total, 4);
    } finally {
      await db().query('DELETE FROM source_items WHERE id=ANY($1::uuid[])', [
        [...ids, ...listingIds],
      ]);
      await db().query('DELETE FROM jobs WHERE id=ANY($1::uuid[])', [
        [...ids, ...listingIds],
      ]);
      await db().end();
    }
  },
);
