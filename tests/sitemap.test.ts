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
  sitemapCacheControl,
  combinedSitemapResponse,
  sitemapIndexResponse,
  sitemapLeaves,
} from '../lib/sitemap';

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

void test('the sitemap index lists the four leaf sitemaps and never touches the database', async () => {
  await withoutDatabase(async () => {
    for (const get of [indexGET, vacanciesIndexGET]) {
      const response = await get();
      assert.equal(response.status, 200);
      assert.equal(
        response.headers.get('Content-Type'),
        'application/xml; charset=utf-8',
      );
      const body = await response.text();
      assert.match(body, /<sitemapindex /);
      for (const name of ['pages', 'categories', 'companies', 'jobs']) {
        assert.ok(
          body.includes(`<loc>https://jobx.ge/sitemap-${name}.xml</loc>`),
        );
      }
    }
  });
});

void test('sitemap-pages.xml has no database dependency', async () => {
  await withoutDatabase(async () => {
    const response = await pagesGET();
    assert.equal(response.status, 200);
    const body = await response.text();
    assert.match(body, /<urlset /);
    assert.ok(body.includes('<loc>https://jobx.ge/</loc>'));
    assert.ok(body.includes('<loc>https://jobx.ge/post-job</loc>'));
    assert.ok(body.includes('<loc>https://jobx.ge/cv</loc>'));
  });
});

void test('sitemap-categories.xml, sitemap-companies.xml and sitemap-jobs.xml retry soon when the database fails', async () => {
  await withoutDatabase(async () => {
    for (const get of [categoriesGET, companiesGET, jobsGET]) {
      const response = await get();
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('Cache-Control'), 'no-store');
      const body = await response.text();
      assert.match(body, /<urlset /);
      assert.match(body, /<\/urlset>/);
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
  assert.equal(robots().sitemap, 'https://jobx.ge/sitemap.xml');
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

void test(
  'landing census agrees with actual filtered results on the local database',
  { skip: process.env.RUN_DB_TESTS !== '1' },
  async () => {
    assert.equal(new URL(process.env.DATABASE_URL!).hostname, 'localhost');
    assert.equal(new URL(process.env.DATABASE_URL!).pathname, '/ertad_test');
    const { allLandingCounts } = await import('../lib/server/sitemap-data');
    const { searchPlan } = await import('../lib/server/search-plan');
    const { db } = await import('../lib/server/db');
    const { landingPath, eligibleLandings } =
      await import('../lib/seo-landing');
    const { searchesEntries } = await import('../lib/server/sitemap-entries');
    const ids: string[] = [];
    try {
      for (const city of ['თბილისი', 'თბილისი, ბათუმი', '', 'სამგორი']) {
        const id = randomUUID();
        ids.push(id);
        const vacancy = {
          title: 'Developer',
          company: `Catalogue fixture ${id}`,
          city,
          category: 'ტექნოლოგიები',
          salary: '2000 ლარი',
          mode: 'დისტანციური',
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
      await db().end();
    }
  },
);
