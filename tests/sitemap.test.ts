import test from 'node:test';
import assert from 'node:assert/strict';
import { GET as mainGET } from '../app/sitemap.xml/route';
import robots from '../app/robots';
import {
  sitemapCacheControl,
  combinedSitemapResponse,
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
    assert.match(body, /<urlset /);
    assert.doesNotMatch(body, /<sitemapindex/);
    assert.ok(body.includes('<loc>https://jobx.ge/</loc>'));
    assert.ok(body.includes('<loc>https://jobx.ge/post-job</loc>'));
  } finally {
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
  }
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
