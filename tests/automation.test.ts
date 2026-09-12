import test from 'node:test';
import assert from 'node:assert/strict';
import { publishable } from '../worker/automation';
import { parseDetail, UnavailableVacancy } from '../worker/adapters';
import {
  deferredSourceFailure,
  failureNeedsPerson,
  timeoutsBeforeAlarm,
} from '../worker/http';
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
void test('a timeout needs a person only when it keeps happening; anything else needs one at once', () => {
  const timeout = 'Source request failed: UND_ERR_CONNECT_TIMEOUT';
  assert.equal(timeoutsBeforeAlarm, 3);
  assert.equal(
    failureNeedsPerson(timeout, false, 1),
    false,
    'first timeout is the network',
  );
  assert.equal(
    failureNeedsPerson(timeout, false, 2),
    false,
    'second in a row is still the network',
  );
  assert.equal(
    failureNeedsPerson(timeout, false, 3),
    true,
    'third in a row may be a block',
  );
  assert.equal(
    failureNeedsPerson(timeout, false, undefined),
    true,
    'an unknown count is not assumed benign',
  );
  assert.equal(
    failureNeedsPerson(timeout, true, 9),
    false,
    'a deferred source is already expected to time out',
  );
  assert.equal(
    failureNeedsPerson('Vacancy structure changed', false, 1),
    true,
    'a parser failure is never waited out',
  );
  assert.equal(
    failureNeedsPerson('Source returned HTTP 403', false, 1),
    true,
    'a refusal is an answer, not a timeout',
  );
});
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

void test('a private advertisement publishes without an employer; other sources still need one', () => {
  const ad = {
    title: 'მზარეული',
    company: '',
    city: 'თბილისი',
    category: 'სხვა',
    salary: '',
    salaryMin: null,
    currency: '',
    salaryPeriod: '',
    mode: '',
    description:
      'საოჯახო სამზარეულოში გვჭირდება მზარეული, გრაფიკი შეთანხმებით.',
    url: 'https://gancxadebebi.ge/ka/განცხადებები/დასაქმება-სამუშაო-3/ვაკანსია-25/mzareuli-GEO1514848',
    source: 'gancxadebebi.ge',
    deadline: '',
    datePosted: '2026-09-01',
  };
  assert.ok(publishable(ad, 'gancxadebebi', ad.url, '2026-09-11'));
  assert.equal(
    publishable(
      { ...ad, source: 'jobs.ge', url: 'https://jobs.ge/ge/?view=jobs&id=1' },
      'jobs',
      'https://jobs.ge/ge/?view=jobs&id=1',
      '2026-09-11',
    ),
    null,
  );
});

void test('a refused or reset connection is the network; a missing name is not', () => {
  const refused = 'Source request failed: ECONNREFUSED';
  assert.equal(failureNeedsPerson(refused, false, 1), false);
  assert.equal(failureNeedsPerson(refused, false, 3), true);
  assert.equal(
    failureNeedsPerson('Source request failed: ECONNRESET', false, 2),
    false,
  );
  assert.equal(
    failureNeedsPerson('Source request failed: ENOTFOUND', false, 1),
    true,
    'a name that does not exist is not waited out',
  );
});
