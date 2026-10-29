import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { load } from 'cheerio';
import { externalId, listLinks, parseDetail } from '../worker/adapters';
import { infobatumiPosted } from '../worker/adapters/infobatumi';
import { importVacancyDateReason } from '../worker/new-only';
import { UnavailableVacancy } from '../worker/adapters/module';
import { publishable } from '../worker/automation';
const fixture = (name: string) =>
  readFileSync(`tests/fixtures/infobatumi-${name}.html`, 'utf8');
const url = 'https://www.infobatumi.ge/?p=38291';

void test('Infobatumi discovers only vacancies in its complete main feed', () => {
  const html = fixture('list');
  const links = listLinks('infobatumi', html);
  assert.equal(links.length, 3);
  assert.ok(links.every((link) => link.externalId !== '999'));
  assert.throws(
    () => listLinks('infobatumi', html.replace('3 სულ', '4 სულ')),
    /incomplete/,
  );
  assert.throws(
    () => listLinks('infobatumi', '<main>Service unavailable</main>'),
    /listing missing/,
  );
  assert.throws(
    () =>
      listLinks(
        'infobatumi',
        html.replace(
          /https:\/\/www.infobatumi.ge\/vakansiebi\//g,
          'https://evil.test/vakansiebi/',
        ),
      ),
    /identity/,
  );
});
void test('Infobatumi preserves daily rates, employer, contacts and source map coordinates', (t) => {
  t.mock.timers.enable({
    apis: ['Date'],
    now: Date.parse('2026-10-29T18:00:00Z'),
  });
  for (const [name, id, amount] of [
    ['cook', '38291', 80],
    ['waiter', '38284', 75],
  ] as const) {
    const job = parseDetail(
      'infobatumi',
      fixture(name),
      `https://www.infobatumi.ge/?p=${id}`,
    );
    assert.equal(job.company, 'Neuron pub');
    assert.equal(job.city, 'ბათუმი');
    assert.equal(job.salaryMin, amount);
    assert.equal(job.salaryPeriod, 'დღე');
    assert.equal(job.currency, 'GEL');
    assert.deepEqual(job.coordinates, { lat: 41.64943, lon: 41.63467 });
    assert.match(job.description, /577 ?414 ?017/);
    assert.doesNotMatch(
      job.description,
      /RELATED_OTHER_COMPANY|9000|unrelated@example/,
    );
    assert.ok(job.logoUrl?.startsWith('https://www.infobatumi.ge/'));
    assert.equal(importVacancyDateReason(job), null);
    assert.ok(publishable(job, 'infobatumi', job.url));
  }
  const job = parseDetail(
    'infobatumi',
    fixture('monthly'),
    'https://www.infobatumi.ge/?p=32565',
  );
  assert.notEqual(job.salaryPeriod, 'დღე');
  assert.equal(job.salaryMin, 1000);
  const shift = load(fixture('cook'));
  shift('[data-id="c0b4051"]').text('8 საათში 45₾');
  const shiftJob = parseDetail('infobatumi', shift.html(), url);
  assert.equal(shiftJob.salary, '45₾ / 8 საათი');
  assert.equal(shiftJob.salaryPeriod, '8 საათი');
  const noPoint = load(fixture('cook'));
  noPoint('[data-id="edc3674"]').remove();
  assert.notEqual(
    parseDetail('infobatumi', noPoint.html(), url).city,
    'ბათუმი',
    'A portal name is not evidence of job location',
  );
});
void test('Infobatumi dates follow publication text, exclude stale and undated jobs, and handle year boundaries', (t) => {
  const now = new Date('2026-10-29T18:00:00Z');
  assert.equal(infobatumiPosted('განთავსებულია 3 დღის წინ', now), '2026-10-26');
  assert.equal(infobatumiPosted('ბოლოს განახლდა 29 ოქტომბერი', now), '');
  assert.equal(
    infobatumiPosted(
      'განთავსებულია 2 საათის წინ',
      new Date('2027-01-01T00:30:00+04:00'),
    ),
    '2026-12-31',
  );
  t.mock.timers.enable({ apis: ['Date'], now: now.getTime() });
  const old = load(fixture('cook'));
  old('[data-id="586f795"]').text('განთავსებულია 8 დღის წინ');
  assert.equal(
    importVacancyDateReason(parseDetail('infobatumi', old.html(), url)),
    'outside_window',
  );
  old('[data-id="586f795"]').text('ბოლოს განახლდა დღეს');
  assert.equal(
    importVacancyDateReason(parseDetail('infobatumi', old.html(), url)),
    'undated',
  );
  t.mock.timers.setTime(Date.parse('2026-12-29T18:00:00Z'));
  old('[data-id="586f795"]').text('განთავსებულია 2 საათის წინ');
  old('[data-id="866cc03"]').text('ბოლო ვადა: 29 იანვარი');
  assert.equal(
    parseDetail('infobatumi', old.html(), url).deadline,
    '2027-01-29',
  );
});
void test('Infobatumi rejects closed, mismatched and offsite vacancy identities', () => {
  for (const bad of [
    url.replace('https:', 'http:'),
    url.replace('www.infobatumi.ge', 'evil.test'),
    url + '&extra=1',
    url + '#x',
    url.replace('?p=38291', '?p=x'),
  ])
    assert.equal(externalId('infobatumi', bad), null);
  assert.throws(
    () =>
      parseDetail('infobatumi', fixture('cook'), url.replace('38291', '38284')),
    /identity/,
  );
  assert.throws(
    () =>
      parseDetail(
        'infobatumi',
        fixture('cook').replace('postid-38291', 'postid-99'),
        url,
      ),
    /identity/,
  );
  const closed = load(fixture('cook'));
  closed('[data-id="06d28bc"]').html('<h2>ვაკანსია აღარ არის აქტიური</h2>');
  assert.throws(
    () => parseDetail('infobatumi', closed.html(), url),
    UnavailableVacancy,
  );
  closed('[data-id="06d28bc"]').remove();
  assert.throws(
    () => parseDetail('infobatumi', closed.html(), url),
    /fields missing/,
  );
});
