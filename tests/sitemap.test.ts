import test from 'node:test';
import assert from 'node:assert/strict';
import { GET as indexGET } from '../app/sitemap-index.xml/route';
import { GET as legacyIndexGET } from '../app/sitemap.xml/route';
import {
  sitemapCacheControl,
  sitemapIndexResponse,
  sitemapUnavailable,
  urlsetResponse,
} from '../lib/sitemap';

void test('both discovery URLs remain available without a configured database', async () => {
  const previous = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    const bodies: string[] = [];
    for (const get of [indexGET, legacyIndexGET]) {
      const response = get();
      assert.equal(response.status, 200);
      const body = await response.text();
      assert.equal(body.match(/<sitemap>/g)?.length, 3);
      for (const path of [
        '/sitemap-pages.xml',
        '/vacancies/sitemap.xml',
        '/companies/sitemap.xml',
      ])
        assert.ok(body.includes(`<loc>https://jobx.ge${path}</loc>`));
      bodies.push(body);
    }
    assert.equal(bodies[0], bodies[1]);
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
    '/vacancies/sitemap.xml': new Date('2026-09-15T00:00:00.000Z'),
  }).text();
  assert.equal(body.match(/<sitemap>/g)?.length, 3);
  assert.equal(body.match(/<lastmod>/g)?.length, 1);
  assert.ok(
    body.includes(
      'vacancies/sitemap.xml</loc><lastmod>2026-09-15T00:00:00.000Z</lastmod>',
    ),
  );
});
