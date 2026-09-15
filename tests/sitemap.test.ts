import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sitemapCacheControl,
  sitemapUnavailable,
  urlsetResponse,
} from '../lib/sitemap';

void test('a vacancy or company sitemap is held at the edge and its URLs are escaped', async () => {
  const response = urlsetResponse([
    'https://jobx.ge/vacancies/a',
    'https://jobx.ge/companies/a&b',
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
  assert.ok(body.includes('<loc>https://jobx.ge/companies/a&amp;b</loc>'));
});

void test('a failed sitemap build is never cached', () => {
  const response = sitemapUnavailable();
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});
