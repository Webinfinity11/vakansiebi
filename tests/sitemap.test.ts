import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { GET as indexGET } from '../app/sitemap.xml/route';
import { GET as vacanciesIndexGET } from '../app/vacancies-sitemap.xml/route';
import { GET as pagesGET } from '../app/sitemap-pages.xml/route';
import { GET as categoriesGET } from '../app/sitemap-categories.xml/route';
import { GET as companiesGET } from '../app/sitemap-companies.xml/route';
import { GET as jobsGET } from '../app/sitemap-jobs.xml/route';
import robots from '../app/robots';
import {
  vacanciesEntries,
  vacancySitemapEntries,
} from '../lib/server/sitemap-entries';
import { vacancyUrl } from '../lib/seo';
import { GET as contentGET } from '../app/sitemap-content.xml/route';
import {
  createSitemapHandler,
  sitemapCacheControl,
  combinedSitemapResponse,
  sitemapIndexResponse,
  sitemapLeaves,
} from '../lib/sitemap';

void test('search crawlers skip vacancy images while social previews keep wildcard access', () => {
  const { rules } = robots();
  assert.ok(Array.isArray(rules));
  const wildcard = rules.find((rule) => rule.userAgent === '*');
  assert.ok(wildcard);
  const imagePaths = [
    '/vacancies/*/opengraph-image',
    '/vacancies/*/twitter-image',
  ];
  for (const bot of ['Googlebot', 'Bingbot']) {
    const group: (typeof rules)[number] | undefined = rules.find(
      (rule) => Array.isArray(rule.userAgent) && rule.userAgent.includes(bot),
    );
    assert.ok(group, bot);
    assert.deepEqual(group.allow, wildcard.allow);
    assert.ok(group.allow?.includes('/'));
    assert.deepEqual(group.disallow, [
      ...(wildcard.disallow as string[]),
      ...imagePaths,
    ]);
  }
  for (const path of imagePaths)
    assert.ok(!wildcard.disallow?.includes(path));
});

void test('vacancy sitemap omits titles with no slug and preserves normal entries', () => {
  const lastModified = new Date('2026-11-13T00:00:00Z');
  const id = 'c761afaa-0a35-43b9-9697-ce120e1f7163';
  assert.deepEqual(
    vacancySitemapEntries([
      { id, title: '🇬🇪', lastModified },
      { id: 'empty', title: '', lastModified },
      { id: 'punctuation', title: '!!!', lastModified },
      { id, title: 'დეველოპერი', lastModified },
    ]),
    [{ url: `https://jobx.ge/vacancies/developeri-${id}`, lastModified }],
  );
});

void test(
  'vacancy sitemap and detail agree on the canonical URL even when an alias is promoted',
  { skip: process.env.RUN_SEO_DB_TESTS !== '1' },
  async () => {
    const database = new URL(process.env.DATABASE_URL!);
    assert.ok(['localhost', '127.0.0.1'].includes(database.hostname));
    assert.equal(database.pathname, '/jobx_company_local');
    const { db, transaction } = await import('../lib/server/db');
    const { publicJobs } = await import('../lib/server/jobs');
    const alias = { id: randomUUID(), title: 'WarehouseLead' };
    const canonical = { id: randomUUID(), title: 'Warehouse Lead' };
    const ids = [alias.id, canonical.id];
    const company = `Canonical SEO fixture ${canonical.id}`;
    try {
      await transaction(async (client) => {
        for (const job of [alias, canonical]) {
          const promoted = job === alias;
          const url = `https://example.invalid/${job.id}`;
          const vacancy = {
            title: job.title,
            company,
            city: 'თბილისი',
            deadline: '2099-01-01',
            description: 'Help lead warehouse operations.',
            source: 'hr.ge',
            url,
          };
          await client.query(
            `INSERT INTO jobs(id,draft,published,status,fingerprint,published_at,placement_tier,placement_expires_at)
             VALUES($1,$2,$2,'published',$3,now()-CASE WHEN $4 THEN interval '1 day' ELSE interval '0' END,
                    CASE WHEN $4 THEN 'premium' ELSE 'standard' END,CASE WHEN $4 THEN now()+interval '1 day' END)`,
            [job.id, vacancy, canonical.id, promoted],
          );
          await client.query(
            `INSERT INTO source_items(id,source_id,external_id,url,job_id,raw)
             VALUES($1::uuid,'hr',$1::text,$2,$1::uuid,$3)`,
            [job.id, url, vacancy],
          );
        }
      });
      const { jobs } = await publicJobs(new URLSearchParams({ ids: alias.id }));
      assert.equal(jobs[0]?.id, alias.id);
      assert.equal(vacancyUrl(jobs[0]), vacancyUrl(canonical));
      assert.notEqual(
        vacancyUrl(jobs[0]),
        vacancyUrl({
          id: canonical.id,
          title: alias.title,
        }),
      );
      const urls = (await vacanciesEntries()).map(({ url }) => url);
      assert.ok(urls.includes(vacancyUrl(canonical)));
      assert.ok(!urls.includes(vacancyUrl(alias)));
    } finally {
      await transaction(async (client) => {
        await client.query(
          'DELETE FROM source_items WHERE job_id=ANY($1::uuid[])',
          [ids],
        );
        await client.query('DELETE FROM jobs WHERE id=ANY($1::uuid[])', [ids]);
      });
      await db().end();
    }
  },
);

async function withoutDatabase(run: () => Promise<void>) {
  const previous = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    await run();
  } finally {
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
  }
}

void test('the sitemap indexes list all leaves even when the network and database are unavailable', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('network unavailable');
  });
  await withoutDatabase(async () => {
    for (const get of [indexGET, vacanciesIndexGET]) {
      const response = get();
      assert.equal(response.status, 200);
      assert.equal(
        response.headers.get('Content-Type'),
        'text/xml; charset=utf-8',
      );
      const body = await response.text();
      assert.match(body, /<sitemapindex /);
      assert.doesNotMatch(body, /<lastmod>/);
      assert.equal(body.match(/<sitemap>/g)?.length, 5);
      for (const name of [
        'pages',
        'categories',
        'companies',
        'jobs',
        'content',
      ]) {
        assert.ok(
          body.includes(`<loc>https://jobx.ge/sitemap-${name}.xml</loc>`),
        );
      }
    }
  });
  assert.equal(fetch.mock.callCount(), 0);
});

void test('sitemap-pages.xml has no database dependency', async () => {
  await withoutDatabase(async () => {
    const response = await pagesGET();
    assert.equal(response.status, 200);
    const body = await response.text();
    assert.match(body, /<urlset /);
    assert.ok(body.includes('<loc>https://jobx.ge/</loc>'));
    assert.ok(
      !body.includes('<loc>https://jobx.ge/post-job</loc>'),
      'noindex form is excluded',
    );
    assert.ok(body.includes('<loc>https://jobx.ge/cv</loc>'));
    assert.ok(body.includes('<loc>https://jobx.ge/blog</loc>'));
    const articles = [
      ...body.matchAll(/<loc>https:\/\/jobx\.ge\/blog\/([^<]+)<\/loc>/g),
    ].map((match) => match[1]);
    assert.deepEqual(
      articles,
      [],
      'articles live in the independently refreshed content sitemap',
    );
    for (const path of ['about', 'help', 'contact', 'salaries'])
      assert.ok(body.includes(`<loc>https://jobx.ge/${path}</loc>`));
    for (const retired of [
      'rogor-shevadaro-vakansiebi',
      'cv-konkretuli-vakansiistvis',
      'pirveli-samsakhuri-gamocdilebis-gareshe',
    ]) {
      assert.ok(!body.includes(`/blog/${retired}`));
    }
  });
});

void test('sitemap-categories.xml, sitemap-companies.xml and sitemap-jobs.xml retry soon when the database fails', async () => {
  await withoutDatabase(async () => {
    for (const get of [categoriesGET, companiesGET, jobsGET, contentGET]) {
      const response = await get();
      assert.equal(response.headers.get('Cache-Control'), 'no-store');
      const body = await response.text();
      assert.equal(response.status, 503);
      assert.equal(response.headers.get('Retry-After'), '300');
      assert.doesNotMatch(body, /<urlset/);
    }
  });
});

void test('sitemapLeaves points every leaf at the site origin', () => {
  const leaves = sitemapLeaves('https://jobx.ge');
  assert.deepEqual(
    leaves.map((leaf) => leaf.url),
    [
      'https://jobx.ge/sitemap-pages.xml',
      'https://jobx.ge/sitemap-categories.xml',
      'https://jobx.ge/sitemap-companies.xml',
      'https://jobx.ge/sitemap-jobs.xml',
      'https://jobx.ge/sitemap-content.xml',
    ],
  );
});

void test('a sitemap index is a flat, escaped list of <sitemap> entries', async () => {
  const response = sitemapIndexResponse([
    { url: 'https://jobx.ge/sitemap-pages.xml' },
    {
      url: 'https://jobx.ge/sitemap-jobs.xml',
      lastModified: new Date('2026-09-18T00:00:00Z'),
    },
  ]);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), sitemapCacheControl);
  const body = await response.text();
  assert.match(body, /<sitemapindex /);
  assert.equal(body.match(/<sitemap>/g)?.length, 2);
  assert.match(body, /<lastmod>2026-09-18T00:00:00.000Z<\/lastmod>/);
  assert.ok(body.endsWith('</sitemapindex>\n'));
});

void test('a leaf sitemap is a flat, escaped, deduplicated URL list', async () => {
  const response = combinedSitemapResponse([
    { url: 'https://jobx.ge/' },
    { url: 'https://jobx.ge/?category=a&city=b' },
    {
      url: 'https://jobx.ge/companies/example',
      lastModified: new Date('2026-09-18T00:00:00Z'),
    },
    { url: 'https://jobx.ge/' },
    { url: 'https://jobx.ge/vacancies/example' },
  ]);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), sitemapCacheControl);
  const body = await response.text();
  assert.match(body, /<urlset /);
  assert.doesNotMatch(body, /<sitemapindex/);
  assert.equal(body.match(/<url>/g)?.length, 4);
  assert.ok(body.includes('<loc>https://jobx.ge/vacancies/example</loc>'));
  assert.match(body, /category=a&amp;city=b/);
  assert.match(body, /<lastmod>2026-09-18T00:00:00.000Z<\/lastmod>/);
  assert.ok(body.endsWith('</urlset>\n'));
  // The index and every leaf, so a crawler that cannot read the index still
  // finds each section on its own line.
  assert.deepEqual(robots().sitemap, [
    'https://jobx.ge/sitemap.xml',
    ...sitemapLeaves('https://jobx.ge').map((leaf) => leaf.url),
  ]);
});

void test('an oversized catalogue is truncated to 50000 URLs', async () => {
  const entries = Array.from({ length: 50_001 }, (_, id) => ({
    url: `https://jobx.ge/companies/${id}`,
  }));
  const body = await combinedSitemapResponse(entries).text();
  assert.match(body, /<urlset /);
  assert.equal(body.match(/<url>/g)?.length, 50_000);
  assert.ok(body.includes('<loc>https://jobx.ge/companies/49999</loc>'));
  assert.ok(!body.includes('<loc>https://jobx.ge/companies/50000</loc>'));
});

void test('categories sitemap omits unverified landings when the stored counts are stale, empty or thin', async (t) => {
  const { db } = await import('../lib/server/db');
  const { clearLandingCountsCache } =
    await import('../lib/server/sitemap-data');
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL ??= 'postgresql://localhost:5432/jobx_company_local';
  const computedAt = new Date(Date.now() - 60_000);
  const row = {
    category: null,
    city: 'თბილისი',
    trait: null,
    role: null,
    count: 10,
    computed_at: computedAt,
  };
  let rows = [row];
  t.mock.method(db(), 'query', async () => ({ rows }));
  try {
    clearLandingCountsCache();
    const fresh = await categoriesGET();
    const body = await fresh.text();
    assert.equal(fresh.headers.get('Cache-Control'), sitemapCacheControl);
    assert.equal(body.match(/<loc>/g)?.length, 1);
    assert.doesNotMatch(body, /<lastmod>/);
    rows = [{ ...row, computed_at: new Date() }];
    clearLandingCountsCache();
    assert.equal(
      await (await categoriesGET()).text(),
      body,
      'refreshing unchanged counts does not change sitemap metadata',
    );
    for (const unavailable of [
      [],
      [{ ...row, count: 9 }],
      [{ ...row, computed_at: new Date(Date.now() - 86_400_001) }],
    ]) {
      rows = unavailable;
      clearLandingCountsCache();
      const response = await categoriesGET();
      assert.equal(response.status, 503);
      assert.equal(response.headers.get('Cache-Control'), 'no-store');
      assert.doesNotMatch(await response.text(), /<loc>/);
    }
    rows = [row];
    clearLandingCountsCache();
    assert.equal(
      (await categoriesGET()).headers.get('Cache-Control'),
      sitemapCacheControl,
    );
  } finally {
    clearLandingCountsCache();
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
  }
});

void test(
  'landing census agrees with actual filtered results on the local database',
  { skip: process.env.RUN_DB_TESTS !== '1' },
  async () => {
    assert.equal(new URL(process.env.DATABASE_URL!).hostname, 'localhost');
    assert.equal(new URL(process.env.DATABASE_URL!).pathname, '/ertad_test');
    const { allLandingCounts } = await import('../lib/server/sitemap-data');
    const { searchPlan } = await import('../lib/server/search-plan');
    const { refreshLandingCounts } = await import('../worker/landing-counts');
    const { db } = await import('../lib/server/db');
    const { landingPath, eligibleLandings } =
      await import('../lib/seo-landing');
    const { searchesEntries } = await import('../lib/server/sitemap-entries');
    const ids: string[] = [];
    try {
      for (const city of [
        'თბილისი',
        'თბილისი, ბათუმი',
        '',
        'სამგორი',
        'თბილისი',
        ...Array<string>(10).fill('თბილისი'),
      ]) {
        const id = randomUUID();
        ids.push(id);
        const vacancy = {
          title: 'Developer',
          // The final row duplicates the first, with different filter answers.
          company: `Catalogue fixture ${ids.length === 5 ? ids[0] : id}`,
          city,
          category: 'ტექნოლოგიები',
          salary: '2000 ლარი',
          mode: ids.length === 5 ? 'ადგილზე' : 'დისტანციური',
          employmentType: 'part-time',
          salaryMin: 80,
          salaryPeriod: 'დღე',
          currency: 'GEL',
          description: 'Developer needed. სამუშაო ადგილი თბილისში.',
          deadline: '2099-01-01',
          datePosted: '2026-09-01',
          url: `https://example.com/catalogue-${id}`,
          source: 'hr.ge',
        };
        await db().query(
          "INSERT INTO jobs(id,draft,published,status,fingerprint,published_at) VALUES($1::uuid,$2,$2,'published',$1::text,now())",
          [id, vacancy],
        );
        await db().query(
          "INSERT INTO source_items(id,source_id,external_id,url,job_id,raw,last_checked_at) VALUES($1::uuid,'hr',$1::text,$2,$1::uuid,$3,now())",
          [id, vacancy.url, vacancy],
        );
      }
      await refreshLandingCounts({ force: true });
      const rows = await allLandingCounts();
      // Cover every dimension, zero counts and nonzero combinations; the fixture
      // includes aliases, multi-city text and city fallbacks.
      const sample = rows.filter(
        (row) =>
          row.count > 0 || row.role === 'დეველოპერი' || row.city === 'გორი',
      );
      for (const row of sample) {
        const plan = searchPlan(
          new URLSearchParams(landingPath(row).slice(2)),
          false,
          { grouped: true },
        );
        const result = await db().query(
          `${plan.cte} SELECT count(*)::int count FROM searchable j WHERE ${plan.where}`,
          plan.args,
        );
        assert.equal(row.count, result.rows[0].count, landingPath(row));
      }
      // The developer fixtures fill a subcategory page, which the sitemap lists.
      const developers = rows.find(
        (row) =>
          row.subcategory === 'tech-development' && !row.city && !row.trait,
      )!;
      assert.ok(developers.count >= 10, String(developers.count));
      assert.ok(
        (await searchesEntries()).some(
          (row) =>
            row.url ===
            'https://jobx.ge/?category=teknologiebi&subcategory=tech-development',
        ),
      );
      assert.deepEqual(
        (await searchesEntries()).map((row) => row.url).sort(),
        eligibleLandings(rows)
          .map((row) => 'https://jobx.ge' + landingPath(row))
          .sort(),
      );
    } finally {
      await db().query(
        'DELETE FROM source_items WHERE job_id=ANY($1::uuid[])',
        [ids],
      );
      await db().query('DELETE FROM jobs WHERE id=ANY($1::uuid[])', [ids]);
      await refreshLandingCounts({ force: true });
      await db().end();
    }
  },
);

void test('all successful leaves explicitly cache at the CDN and failures do not', async () => {
  for (const response of [await pagesGET(), combinedSitemapResponse([])]) {
    for (const header of [
      'Cache-Control',
      'CDN-Cache-Control',
      'Vercel-CDN-Cache-Control',
    ])
      assert.equal(response.headers.get(header), sitemapCacheControl);
  }
  const get = createSitemapHandler(async () => {
    throw new Error('database unavailable');
  });
  const response = await get();
  for (const header of [
    'Cache-Control',
    'CDN-Cache-Control',
    'Vercel-CDN-Cache-Control',
  ])
    assert.equal(response.headers.get(header), 'no-store');
});

void test('a cold leaf that cannot count still names the curated pages', async () => {
  const get = createSitemapHandler(
    () => new Promise(() => {}),
    20,
    () => [{ url: 'https://jobx.ge/?category=gayidvebi' }],
  );
  const body = await (await get()).text();
  assert.match(body, /category=gayidvebi/);
});

void test('a hung cold leaf reports temporary failure within its deadline and retries', async () => {
  let hung = true;
  const get = createSitemapHandler(
    () =>
      hung
        ? new Promise(() => {})
        : Promise.resolve([{ url: 'https://jobx.ge/?city=tbilisi' }]),
    20,
  );
  const started = performance.now();
  const response = await get();
  assert.ok(performance.now() - started < 500);
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(response.headers.get('Retry-After'), '300');
  assert.doesNotMatch(await response.text(), /<urlset/);
  hung = false;
  const retry = await get();
  assert.match(await retry.text(), /city=tbilisi/);
  assert.equal(retry.headers.get('Cache-Control'), sitemapCacheControl);
});

void test('a failed or hung refresh preserves the last good leaf but never caches failure', async () => {
  let mode = 'ok';
  const get = createSitemapHandler(async () => {
    if (mode === 'hung') return new Promise(() => {});
    if (mode === 'failed') throw new Error('database unavailable');
    return [{ url: 'https://jobx.ge/?city=tbilisi' }];
  }, 20);
  await get();
  for (mode of ['failed', 'hung']) {
    const response = await get();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.match(await response.text(), /city=tbilisi/);
  }
});

void test('an empty refresh cannot replace the previous complete sitemap', async () => {
  let entries = [{ url: 'https://jobx.ge/vacancies/example' }];
  const get = createSitemapHandler(async () => entries);
  await get();
  entries = [];
  const response = await get();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.match(await response.text(), /vacancies\/example/);
  assert.equal((await createSitemapHandler(async () => [])()).status, 503);
});

void test('persistent snapshots preserve dates and fit a large catalogue in one cache entry', async () => {
  const { encodeSitemapSnapshot, decodeSitemapSnapshot } =
    await import('../lib/server/sitemap-snapshot');
  const entries = Array.from({ length: 45_000 }, (_, i) => ({
    url: `https://jobx.ge/vacancies/example-${i}-${randomUUID()}`,
    lastModified: new Date('2026-09-23T07:00:00.000Z'),
  }));
  const snapshot = encodeSitemapSnapshot(entries);
  assert.ok(Buffer.byteLength(JSON.stringify(entries)) > 2_000_000);
  assert.ok(Buffer.byteLength(snapshot) < 1_900_000);
  assert.deepEqual(decodeSitemapSnapshot(snapshot), entries);
  assert.throws(() => encodeSitemapSnapshot([]), /no URLs/);
});
