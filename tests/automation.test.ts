import test from 'node:test';
import assert from 'node:assert/strict';
import { publishable } from '../worker/automation';
import { parseDetail, UnavailableVacancy } from '../worker/adapters';
import { deferredSourceFailure } from '../worker/http';
const vacancy = {
  title: 'Developer',
  company: 'Studio',
  city: '',
  category: 'ტექნოლოგიები',
  salary: '',
  salaryMin: null,
  currency: '',
  salaryPeriod: '',
  mode: '',
  description:
    'Join our experienced development team and create useful products.',
  url: 'https://www.hr.ge/announcement/123/test',
  source: 'hr.ge',
  datePosted: '2026-09-01',
  deadline: '2026-10-01',
};
void test('known government network failure is deferred without disguising parser or other source failures', () => {
  assert.equal(
    deferredSourceFailure(
      'hrgov',
      'Source request failed: UND_ERR_CONNECT_TIMEOUT',
    ),
    true,
  );
  assert.equal(
    deferredSourceFailure('hrgov', 'Vacancy structure changed'),
    false,
  );
  assert.equal(
    deferredSourceFailure(
      'hr',
      'Source request failed: UND_ERR_CONNECT_TIMEOUT',
    ),
    false,
  );
});
void test('automatic quality gate permits honest omissions but rejects malformed, expired and offsite records', () => {
  const check = (v: unknown, source = 'hr', url = vacancy.url) =>
    publishable(v, source, url, '2026-09-09');
  assert.ok(check(vacancy));
  assert.equal(check({ ...vacancy, company: '' }), null);
  assert.equal(check({ ...vacancy, description: 'Empty' }), null);
  assert.equal(check({ ...vacancy, deadline: '2026-09-08' }), null);
  assert.equal(check({ ...vacancy, datePosted: '2027-01-01' }), null);
  assert.equal(
    check(
      { ...vacancy, url: 'https://evil.test/' },
      'hr',
      'https://evil.test/',
    ),
    null,
  );
  assert.equal(check(vacancy, 'samushao'), null);
});
void test('empty Jobs.ge template is recognized as an unavailable vacancy, not valid data', () => {
  assert.throws(
    () =>
      parseDetail(
        'jobs',
        '<table><tr><td class="dtitle"></td><td class="dtitle"></td><td class="dtitle"></td></tr><tr><td></td></tr></table>',
        'https://jobs.ge/ge/?view=jobs&id=42',
      ),
    UnavailableVacancy,
  );
});

void test('unsupported optional logo does not unpublish valid text or weaken core validation', () => {
  const image = { ...vacancy, logoUrl: 'https://unsupported.example/logo.png' };
  const result = publishable(image, 'hr', vacancy.url, '2026-09-09');
  assert.ok(result);
  assert.equal(result.logoUrl, '');
  assert.equal(result.description, vacancy.description);
  assert.equal(
    publishable({ ...image, description: '' }, 'hr', vacancy.url, '2026-09-09'),
    null,
  );
  const supported =
    'https://helio-ai-assets-prod.s3.amazonaws.com/company/logo.png';
  assert.equal(
    publishable(
      { ...vacancy, logoUrl: supported },
      'hr',
      vacancy.url,
      '2026-09-09',
    )?.logoUrl,
    supported,
  );
});
