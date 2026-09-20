import test from 'node:test';
import assert from 'node:assert/strict';
import { GET as indexGET } from '../app/sitemap-index.xml/route';
import { GET as mainGET } from '../app/sitemap.xml/route';
import robots from '../app/robots';
import {
  sitemapCacheControl,
  combinedSitemapResponse,
  sitemapIndexResponse,
  sitemapPaths,
  sitemapUnavailable,
  urlsetResponse,
} from '../lib/sitemap';

void test('the submitted sitemap keeps discovery available when the database fails', async () => {
  const previous = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    const response = await mainGET();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.equal(response.headers.get('Content-Type'), 'application/xml; charset=utf-8');
    const body = await response.text();
    assert.equal(body, await indexGET().text());
    for (const path of sitemapPaths)
      assert.ok(body.includes(`<loc>https://jobx.ge${path}</loc>`));
  } finally {
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
  }
});

void test('the legacy discovery index remains available without a configured database', async () => {
  const previous = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    const bodies: string[] = [];
    for (const get of [indexGET]) {
      const response = get();
      assert.equal(response.status, 200);
      const body = await response.text();
      assert.equal(body.match(/<sitemap>/g)?.length, sitemapPaths.length);
      for (const path of sitemapPaths)
        assert.ok(body.includes(`<loc>https://jobx.ge${path}</loc>`));
      bodies.push(body);
    }
    assert.ok(bodies[0].includes('<loc>https://jobx.ge/vacancies/sitemap.xml</loc>'));
  } finally {
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
  }
});

void test('a vacancy or company sitemap is held at the edge and its URLs are escaped', async () => {
  const response = urlsetResponse([
    {
      url: 'https://jobx.ge/vacancies/a',
      lastModified: new Date('2026-09-15T12:43:35.382Z'),
    },
    { url: 'https://jobx.ge/companies/a&b' },
  ]);
  assert.equal(response.headers.get('Cache-Control'), sitemapCacheControl);
  assert.match(sitemapCacheControl, /s-maxage=\d+/);
  assert.equal(
    response.headers.get('Content-Type'),
    'application/xml; charset=utf-8',
  );
  const body = await response.text();
  assert.ok(body.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
  assert.equal(body.match(/<loc>/g)?.length, 2);
  assert.ok(
    body.includes('<loc>https://jobx.ge/companies/a&amp;b</loc></url>'),
  );
  assert.ok(
    body.includes(
      '<loc>https://jobx.ge/vacancies/a</loc><lastmod>2026-09-15T12:43:35.382Z</lastmod>',
    ),
  );
});

void test('a failed sitemap build is never cached', () => {
  const response = sitemapUnavailable();
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});

void test('the index dates a section only when its date is known', async () => {
  const body = await sitemapIndexResponse({
    '/companies/sitemap.xml': new Date('2026-09-15T00:00:00.000Z'),
  }).text();
  assert.equal(body.match(/<sitemap>/g)?.length, sitemapPaths.length);
  assert.equal(body.match(/<lastmod>/g)?.length, 1);
  assert.ok(
    body.includes(
      'companies/sitemap.xml</loc><lastmod>2026-09-15T00:00:00.000Z</lastmod>',
    ),
  );
});

void test('the main sitemap is a flat, escaped, deduplicated URL list', async () => {
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

void test('an oversized catalogue falls back to the section index without truncating URLs', async () => {
  const entries = Array.from({ length: 50_001 }, (_, id) => ({
    url: `https://jobx.ge/companies/${id}`,
  }));
  const body = await combinedSitemapResponse(entries).text();
  assert.match(body, /<sitemapindex /);
  for (const path of sitemapPaths)
    assert.ok(body.includes(`https://jobx.ge${path}`));
});
