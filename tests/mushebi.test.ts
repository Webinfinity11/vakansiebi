import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { load } from 'cheerio';
import {
  listLinks,
  parseDetail,
  externalId,
  detailRequestUrl,
} from '../worker/adapters';
import { importVacancyDateReason } from '../worker/new-only';
import { publishable } from '../worker/automation';
import { mushebiCareersUrl } from '../worker/mushebi-url';
import { UnavailableVacancy } from '../worker/adapters/module';

const html = readFileSync('tests/fixtures/mushebi-careers.html', 'utf8');
void test('Mushebi reads three distinct roles with their own daily salary and original contact', () => {
  const links = listLinks('mushebi', html);
  assert.equal(links.length, 3);
  const vacancies = links.map((link) => parseDetail('mushebi', html, link.url));
  assert.deepEqual(
    vacancies.map((v) => [v.title, v.salaryMin, v.salaryPeriod]),
    [
      ['მტვირთავი / მუშა', 50, 'დღე'],
      ['დამხმარე მუშა', 60, 'დღე'],
      ['სატვირთო მძღოლი', 70, 'დღე'],
    ],
  );
  assert.deepEqual(
    vacancies.map((v) => v.salary),
    ['50–80 ₾ / დღე', '60–100 ₾ / დღე', '70–120 ₾ / დღე'],
  );
  for (const job of vacancies) {
    assert.equal(job.company, 'Mushebi.ge');
    assert.equal(job.city, 'თბილისი');
    assert.equal(job.datePosted, '');
    assert.equal(job.deadline, '');
    assert.equal(job.currency, 'GEL');
    assert.equal(importVacancyDateReason(job), null);
    assert.ok(publishable(job, 'mushebi', job.url));
    assert.match(job.description, /პუნქტუალობა/);
    assert.equal(job.applicationLinks?.[0].label, 'WhatsApp');
    assert.equal(detailRequestUrl('mushebi', job.url), mushebiCareersUrl);
  }
  assert.doesNotMatch(vacancies[0].description, /სატვირთო ტაქსი/);
  assert.equal(
    importVacancyDateReason({ ...vacancies[0], source: 'jobs.ge' }),
    'undated',
  );
});

void test('Mushebi rejects offsite identities, changed pay units and incomplete pages', () => {
  const url = listLinks('mushebi', html)[0].url;
  for (const bad of [
    url.replace('mushebi.ge', 'evil.test'),
    url.replace('https:', 'http:'),
    url.replace('/ka/', '/en/'),
    url.replace('mushebi.ge', 'mushebi.ge:444'),
    url.replace('/vacancies#', '/vacancies?x=1#'),
    mushebiCareersUrl,
  ])
    assert.equal(externalId('mushebi', bad), null);
  for (const bad of [
    html.replace('50-80₾/დღე', '50-80₾/თვე'),
    html.replace('50-80₾/დღე', '80-50₾/დღე'),
    html.replace('მოთხოვნები', 'დაკარგული ველი'),
    '<main>Service unavailable</main>',
  ])
    assert.throws(() => listLinks('mushebi', bad));
  const $ = load(html);
  $('h2')
    .filter((_, el) => $(el).text() === 'მტვირთავი / მუშა')
    .parent()
    .remove();
  assert.throws(
    () => parseDetail('mushebi', $.html(), url),
    UnavailableVacancy,
  );
  const noDaily = html.replace(
    'ყოველდღიური ანაზღაურება',
    'ანაზღაურება თვეში ერთხელ',
  );
  assert.ok(
    !parseDetail('mushebi', noDaily, url).facts?.some(
      (f) => f.label === 'ანაზღაურების გაცემა',
    ),
  );
});
