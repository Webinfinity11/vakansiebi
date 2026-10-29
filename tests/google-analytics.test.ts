import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  analyticsPage,
  analyticsReferrer,
  analyticsEvent,
  analyticsTitle,
  analyticsFallbackTitle,
} from '../lib/google-analytics';

void test('GA page titles preserve SEO identity without exposing a typed search', () => {
  const page = analyticsPage('https://jobx.ge/?q=private@example.com')!;
  assert.equal(
    analyticsTitle(page, '„private@example.com“ — ვაკანსიები | JOBX'),
    'ჯობიქსი — ვაკანსიები საქართველოში',
  );
  assert.equal(
    analyticsTitle('https://jobx.ge/?salaryPeriod=day', 'old browser title'),
    'ვაკანსიები დღიური ანაზღაურებით | ჯობიქსი',
  );
  assert.equal(
    analyticsTitle(
      'https://jobx.ge/companies/tibisi',
      'თიბისის ვაკანსიები | JOBX',
    ),
    'თიბისის ვაკანსიები | JOBX',
  );
});

void test('unfinished route metadata stays pending and timeout titles contain no private data', () => {
  const page = 'https://jobx.ge/vacancies/example-123';
  assert.equal(analyticsTitle(page, '  '), '');
  assert.equal(analyticsFallbackTitle(page), 'ვაკანსია | ჯობიქსი');
  assert.equal(
    analyticsFallbackTitle('https://jobx.ge/companies/tibisi'),
    'კომპანიის ვაკანსიები | ჯობიქსი',
  );
  assert.equal(
    analyticsFallbackTitle('https://jobx.ge/cv'),
    'CV-ის შექმნა | ჯობიქსი',
  );
  assert.equal(
    analyticsFallbackTitle('https://jobx.ge/?q=private@example.com'),
    'ჯობიქსი — ვაკანსიები საქართველოში',
  );
});

void test('SEO landing identity joins GA visits to Search Console without leaking arbitrary query values', () => {
  for (const query of [
    'city=tbilisi',
    'salaryPeriod=day',
    'category=iuridiuli',
    'q=konditeri',
    'employment=internship',
    'category=gayidvebi&city=tbilisi',
  ])
    assert.equal(
      analyticsPage(
        'https://jobx.ge/?' +
          query +
          '&utm_source=test&email=private@example.com',
      ),
      'https://jobx.ge/?' + query,
    );
  assert.equal(
    analyticsPage('https://jobx.ge/?q=dispecheri'),
    'https://jobx.ge/?q=dispetcheri',
  );
  assert.equal(
    analyticsPage('https://jobx.ge/?city=private@example.com'),
    'https://jobx.ge/',
  );
  assert.equal(
    analyticsPage('https://jobx.ge/?city=tbilisi&city=private@example.com'),
    'https://jobx.ge/',
  );
  assert.equal(
    analyticsPage('https://jobx.ge/cv?email=private@example.com', {
      includeCv: true,
    }),
    'https://jobx.ge/cv',
  );
  assert.equal(
    analyticsPage('https://jobx.ge/cv'),
    null,
    'CV analytics must not enable session recording or custom third-party code',
  );
  assert.equal(
    analyticsReferrer('https://jobx.ge/?q=konditeri&token=private'),
    'https://jobx.ge/?q=konditeri',
  );
});

void test('GA outcomes contain only reviewed event names and methods', () => {
  assert.deepEqual(analyticsEvent('cv', 'private-job-id'), {
    name: 'cv_email_click',
    params: { contact_method: 'cv_email' },
  });
  assert.deepEqual(analyticsEvent('call', 'private-job-id'), {
    name: 'call_click',
    params: { contact_method: 'phone' },
  });
  assert.deepEqual(analyticsEvent('email', 'private-job-id'), {
    name: 'contact_email_click',
    params: { contact_method: 'email' },
  });
  assert.deepEqual(analyticsEvent('apply', 'private-job-id'), {
    name: 'application_click',
    params: { contact_method: 'external_form' },
  });
  assert.deepEqual(analyticsEvent('post', 'done'), {
    name: 'job_submitted',
  });
  assert.deepEqual(analyticsEvent('resume', 'printed'), { name: 'cv_print' });
  assert.equal(analyticsEvent('search', 'private@example.com'), null);
  assert.equal(analyticsEvent('resume', 'private@example.com'), null);
  assert.equal(analyticsEvent('post', 'failed'), null);
  assert.equal(
    analyticsEvent('post', 'submitted'),
    null,
    'a press before validation is not a successful submission',
  );
});

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
    'https://jobx.ge/employer-removal?token=private-removal-token',
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

void test('company directory and slug-based vacancy URLs are public analytics pages', () => {
  for (const path of ['/business', '/map']) {
    assert.equal(
      analyticsPage(`https://jobx.ge${path}?q=private#section`),
      `https://jobx.ge${path}`,
    );
    assert.equal(analyticsPage(`https://jobx.ge${path}?preview=1`), null);
    assert.equal(analyticsPage(`http://127.0.0.1:3004${path}`), null);
  }
  assert.equal(
    analyticsPage('https://jobx.ge/companies?page=2'),
    'https://jobx.ge/companies',
  );
  assert.equal(
    analyticsPage('https://jobx.ge/vacancies/example-123?q=private'),
    'https://jobx.ge/vacancies/example-123',
  );
  assert.equal(analyticsPage('https://jobx.ge/cv/private-token'), null);
});

void test('editorial public pages are tracked without private query data; admin and previews stay excluded', () => {
  for (const path of [
    '/blog',
    '/blog/reziume-gamotsdilebis-gareshe',
    '/salaries',
    '/salaries/molare',
    '/about',
    '/contact',
    '/help',
  ]) {
    assert.equal(
      analyticsPage('https://jobx.ge' + path + '?email=private@example.com'),
      'https://jobx.ge' + path,
    );
    assert.equal(analyticsPage('https://jobx.ge' + path + '?preview=1'), null);
  }
  assert.equal(analyticsPage('https://jobx.ge/admin/blog'), null);
});
