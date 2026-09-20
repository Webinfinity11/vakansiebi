import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { db } from '../lib/server/db';
import { GET as companyLinks } from '../app/api/company-links/route';
import { clearPublicJobsCache, publicJobs } from '../lib/server/jobs';
import { publicRead } from '../lib/server/search-plan';
import { ApiError, apiError } from '../lib/server/auth';
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
        description:
          'Previous professional experience is required. olderdescriptiononly',
      },
      {
        title: 'Warehouse Lead',
        company: 'Listing fixture',
        salary: '2500',
        salaryMin: 2500,
        salaryPeriod: '',
        source: 'jobs.ge',
        url: 'https://jobs.ge/ge/?view=jobs&id=9998882',
        description:
          'Previous professional experience is required. newerdescriptiononly',
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
    const extraSources: string[] = [],
      extraItems: string[] = [];
    try {
      const originalTimeout = (await db().query('SHOW statement_timeout'))
        .rows[0];
      assert.deepEqual(
        (
          await publicRead(
            "SELECT current_setting('statement_timeout') AS timeout,current_setting('transaction_read_only') AS readonly",
          )
        ).rows[0],
        { timeout: '12s', readonly: 'on' },
      );
      assert.deepEqual(
        (await db().query('SHOW statement_timeout')).rows[0],
        originalTimeout,
      );
      await assert.rejects(
        publicRead('SELECT pg_sleep(13)'),
        (error: unknown) => {
          assert.ok(error instanceof ApiError);
          assert.equal(apiError(error).status, 503);
          return true;
        },
      );
      assert.deepEqual(
        (await db().query('SHOW statement_timeout')).rows[0],
        originalTimeout,
        'Cancelled public reads restore the pooled connection',
      );
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
      assert.equal(
        (
          await search({
            category: 'ფინანსები',
            subcategory: 'finance-accounting',
          })
        ).total,
        2,
      );
      assert.equal(
        (
          await search({
            category: 'ფინანსები',
            subcategory: 'service-cleaning',
          })
        ).total,
        2,
        'invalid child is ignored',
      );
      const savedState = await search();
      assert.ok(
        'unavailable' in savedState &&
          savedState.unavailable?.some(
            (item) => item.id === ids[7] && item.expired,
          ),
      );
      const linksResponse = await companyLinks(
        new Request(
          'https://example.com/api/company-links?ids=' + ids[0] + ',' + ids[7],
        ),
      );
      const links = (await linksResponse.json()).links;
      assert.ok(links[ids[0]]?.startsWith('/companies/'));
      assert.equal(
        links[ids[7]],
        null,
        'expired IDs never receive employer links',
      );
      const summary = await search({ summary: '1' });
      assert.ok(
        summary.jobs.every(
          (job) => !('companyProfile' in job) && job.description === '',
        ),
      );
      assert.equal((await search({ q: 'დეველოპერი' })).total, 3);
      const corrected = await search({ q: 'develoepr' });
      assert.deepEqual(corrected.search.corrected, {
        from: 'develoepr',
        to: 'developer',
      });
      assert.equal(
        corrected.total,
        3,
        'a spelling correction returns matching results immediately',
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
      const list = (values: Record<string, string> = {}) => {
        // These assertions inspect writes immediately; TTL/coalescing have their own tests.
        clearPublicJobsCache();
        return publicJobs(new URLSearchParams({ q: marker, ...values }));
      };
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
      assert.equal(
        folded.jobs[0].canonicalId,
        listingIds[1],
        'duplicate detail points at the representative shown in the catalogue',
      );
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
        5,
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
      assert.equal(
        (await list({ q: marker + ' olderdescriptiononly' })).total,
        0,
        'a folded member never contributes its description to the representative search',
      );
      const newer = await list({
        q: marker + ' newerdescriptiononly',
        summary: '1',
      });
      assert.deepEqual(
        newer.jobs.map((job) => job.id),
        [listingIds[1]],
      );
      assert.equal(
        newer.jobs[0].description,
        '',
        'summary omits the long description',
      );
      const counted = await list({
        q: marker + ' newerdescriptiononly',
        countsOnly: '1',
      });
      assert.equal(counted.total, newer.total);
      assert.deepEqual(counted.search, newer.search);
      const revealed = await list({
        q: marker + ' olderdescriptiononly',
        exclude: listingIds[1],
      });
      assert.deepEqual(
        revealed.jobs.map((job) => job.id),
        [listingIds[0]],
        'excluding the representative makes the next member and its own text searchable',
      );
      const direct = await publicJobs(
        new URLSearchParams({
          ids: listingIds[0],
          q: marker + ' olderdescriptiononly',
        }),
      );
      assert.equal(
        direct.total,
        1,
        'an ID lookup still searches a folded member',
      );
      assert.equal(direct.jobs[0].sources.length, 2);
      await db().query(
        "UPDATE jobs SET placement_tier='premium',placement_expires_at=now()+interval '1 day' WHERE id=$1",
        [listingIds[0]],
      );
      assert.equal(
        (await list({ q: marker + ' olderdescriptiononly' })).total,
        1,
        'promotion can choose the older representative, including its search document',
      );
      assert.equal(
        (await list({ q: marker + ' newerdescriptiononly' })).total,
        0,
      );
      await db().query(
        "UPDATE jobs SET draft=jsonb_set(draft,'{description}',to_jsonb($2::text)) WHERE id=$1",
        [listingIds[0], marker + ' draftdescriptiononly'],
      );
      assert.equal(
        (await list({ q: marker + ' draftdescriptiononly' })).total,
        0,
        'public searches never use a changed draft',
      );
      const preview = await publicJobs(
        new URLSearchParams({ q: marker + ' draftdescriptiononly' }),
        true,
      );
      assert.deepEqual(
        preview.jobs.map((job) => job.id),
        [listingIds[0]],
      );
      await db().query(
        'UPDATE jobs SET published=published || $2::jsonb WHERE id=$1',
        [
          listingIds[0],
          {
            title: 'Refreshed scalar fixture',
            company: 'Refreshed employer',
            city: 'ბათუმი',
            category: 'ფინანსები',
            datePosted: today,
            deadline: '2099-01-01',
            mode: 'დისტანციური',
            salary: '3500 ლარი',
            salaryMin: 3500,
            currency: 'GEL',
            salaryPeriod: 'თვე',
            description: marker + ' refreshsnapshotonly',
          },
        ],
      );
      const refreshed = await list({
        q: marker + ' refreshsnapshotonly',
        city: 'ბათუმი',
        category: 'ფინანსები',
        postedWithin: '1',
        remote: 'true',
        paid: 'true',
        salaryFrom: '3000',
        sort: 'salary',
      });
      assert.deepEqual(
        refreshed.jobs.map((job) => job.id),
        [listingIds[0]],
        'snapshot writes immediately update every stored filter and salary scalar',
      );
      assert.equal(
        (await list({ q: marker + ' refreshed scalar' })).total,
        1,
        'updated titles feed the public search document',
      );
      assert.equal(
        (await list({ q: marker + ' employer' })).total,
        1,
        'updated company names feed the public search document',
      );
      assert.equal(
        (
          await publicJobs(
            new URLSearchParams({ q: marker + ' refreshsnapshotonly' }),
            true,
          )
        ).total,
        0,
        'draft preview still reads its own live snapshot after published scalars change',
      );
      await db().query(
        "UPDATE jobs SET published=jsonb_set(published,'{deadline}','\"2000-01-01\"'::jsonb) WHERE id=$1",
        [listingIds[0]],
      );
      assert.equal(
        (await list({ q: marker + ' refreshsnapshotonly' })).total,
        0,
        'a changed deadline immediately removes the posting from public results',
      );

      const georgianMarker = 'georgian' + randomUUID().replaceAll('-', '');
      const georgian = [
        { title: 'მოლარე', company: 'ქართული საწარმო', city: 'თბილისი' },
        { title: 'მძღოლი', company: 'ქართული საწარმო', city: 'თბილისი' },
        { title: 'მოლარე', company: 'ქართული საწარმო', city: 'ბათუმი' },
        { title: 'მოლარე', company: 'სხვა საწარმო', city: 'თბილისი' },
        { title: 'მოლარე', company: 'ქართული საწარმო', city: 'თბილისი' },
        { title: 'მოლარე', company: 'კომპანია', city: 'თბილისი' },
        { title: 'მოლარე', company: 'კომპანია', city: 'თბილისი' },
      ];
      const georgianIds = georgian.map(() => randomUUID());
      listingIds.push(...georgianIds);
      for (let i = 0; i < georgian.length; i++) {
        const v = { ...base, ...georgian[i], description: georgianMarker };
        await db().query(
          "INSERT INTO jobs(id,draft,published,status,fingerprint,published_at) VALUES($1,$2,$2,'published',$3,now()+($4||' seconds')::interval)",
          [georgianIds[i], v, fingerprint(v), i],
        );
        await db().query(
          "INSERT INTO source_items(id,source_id,external_id,url,job_id,raw,last_checked_at) VALUES($1::uuid,'hr',$1::text,$2,$1::uuid,$3,now())",
          [
            georgianIds[i],
            `https://www.hr.ge/announcement/${i}/${georgianMarker}`,
            v,
          ],
        );
      }
      const georgianResults = await list({ q: georgianMarker });
      assert.equal(
        georgianResults.total,
        6,
        'Georgian title, employer and city stay distinct, including under the C locale; generic employers never group',
      );
      assert.ok(!georgianResults.jobs.some((job) => job.id === georgianIds[0]));
      assert.ok(georgianResults.jobs.some((job) => job.id === georgianIds[4]));
      for (let i = 0; i < 7; i++) {
        const source = `perf-${i}-${georgianMarker}`;
        extraSources.push(source);
        await db().query('INSERT INTO sources(id,name) VALUES($1,$1)', [
          source,
        ]);
        for (const age of ['old', 'new']) {
          const item = randomUUID();
          extraItems.push(item);
          await db().query(
            "INSERT INTO source_items(id,source_id,external_id,url,job_id,raw,last_checked_at) VALUES($1::uuid,$2,$1::text,$3,$4,'{}',now()-($5||' hours')::interval)",
            [
              item,
              source,
              `https://example.com/${source}/${age}`,
              georgianIds[0],
              age === 'old' ? 24 : 0,
            ],
          );
        }
      }
      const detail = await publicJobs(
        new URLSearchParams({ ids: georgianIds[0] }),
      );
      const sourceSummary = await publicJobs(
        new URLSearchParams({ ids: georgianIds[0], summary: '1' }),
      );
      assert.equal(
        detail.jobs[0].sources.length,
        16,
        'detail retains every link from duplicate members and repeated sources',
      );
      assert.equal(sourceSummary.jobs[0].sources.length, 6);
      assert.equal(
        new Set(
          sourceSummary.jobs[0].sources.map(
            (source: { source: string }) => source.source,
          ),
        ).size,
        6,
      );
      assert.ok(
        sourceSummary.jobs[0].sources.every(
          (source: { url: string }) => !source.url.endsWith('/old'),
        ),
        'summary chooses the most recent link from each source',
      );
      assert.deepEqual(
        sourceSummary.jobs.map((job) => job.id),
        detail.jobs.map((job) => job.id),
      );
      assert.equal(sourceSummary.total, detail.total);
    } finally {
      clearPublicJobsCache();
      await db().query('DELETE FROM source_items WHERE id=ANY($1::uuid[])', [
        [...ids, ...listingIds, ...extraItems],
      ]);
      await db().query('DELETE FROM jobs WHERE id=ANY($1::uuid[])', [
        [...ids, ...listingIds],
      ]);
      await db().query('DELETE FROM sources WHERE id=ANY($1::text[])', [
        extraSources,
      ]);
      await db().end();
    }
  },
);
