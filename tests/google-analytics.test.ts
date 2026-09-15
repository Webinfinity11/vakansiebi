import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyticsPage, analyticsReferrer } from '../lib/google-analytics';

void test('Google Analytics measures production public pages without query strings', () => {
  assert.equal(
    analyticsPage('https://jobx.ge/?q=private@example.com#saved'),
    'https://jobx.ge/',
  );
  assert.equal(
    analyticsPage('https://jobx.ge/post-job?email=private@example.com'),
    'https://jobx.ge/post-job',
  );
  assert.equal(
    analyticsPage(
      'https://jobx.ge/vacancies/11111111-1111-4111-8111-111111111111',
    ),
    'https://jobx.ge/vacancies/11111111-1111-4111-8111-111111111111',
  );
  assert.equal(
    analyticsPage('https://jobx.ge/companies/example'),
    'https://jobx.ge/companies/example',
  );
});

void test('admin, invoices, previews and development never enter Google Analytics', () => {
  for (const url of [
    'https://jobx.ge/admin',
    'https://jobx.ge/admin/login',
    'https://jobx.ge/invoices/private-token',
    'https://jobx.ge/api/jobs',
    'https://jobx.ge/?preview=1',
    'https://jobx.ge/vacancies/11111111-1111-4111-8111-111111111111?preview=1',
    'http://127.0.0.1:3100/',
    'https://preview.vercel.app/',
    'https://jobx.ge.evil.example/',
    'invalid',
  ])
    assert.equal(analyticsPage(url), null, url);
});

void test('referrers retain attribution without private paths or search text', () => {
  assert.equal(
    analyticsReferrer('https://google.com/search?q=private'),
    'https://google.com/',
  );
  assert.equal(
    analyticsReferrer('https://jobx.ge/invoices/private-token'),
    'https://jobx.ge/',
  );
  assert.equal(
    analyticsReferrer('https://jobx.ge/companies/example?token=private'),
    'https://jobx.ge/companies/example',
  );
  assert.equal(analyticsReferrer(''), '');
  assert.equal(analyticsReferrer('javascript:alert(1)'), '');
});
