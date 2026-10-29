import test from 'node:test';
import assert from 'node:assert/strict';
import {
  externalId,
  getSourceConfig,
  listLinks,
  parseDetail,
} from '../worker/adapters';
import { liberty } from '../worker/adapters/liberty';
import { importVacancyDateReason } from '../worker/new-only';
import { completeDescription } from '../worker/linked-description';
import { publishable } from '../worker/automation';

const url =
  'https://www.libertybank.ge/ka/kariera/mimdinare-vakansiebi/1193/molare-inkasatori-tbilisi';
const item = {
  id: 1193,
  title: 'მოლარე-ინკასატორი - თბილისი',
  endDate: '11 ნოემბერი, 2026',
  category: { title: 'ბექ-ოფისი' },
  location: { title: 'თბილისი', cities: [] },
  url: url.replace('https:', ''),
};
const listing = (items: unknown) =>
  `<script>window.vacancies = ${JSON.stringify(items)}; window.other = 1;</script>`;
function detail(canonical = url, date = '11 ნოემბერი, 2026') {
  return `<link rel="canonical" href="${canonical}"><header><img src="/m/i/logo-ka@2x.png?1"></header>
  <div class="vacancy-content"><div class="pagetitle"><h2>${item.title}</h2></div>
  <div class="pagetext"><h2>ადგილმდებარეობა</h2><p>თბილისი</p>
  <h2>სამუშაო საათები</h2><p>სტანდარტული</p><h2>ბოლო ვადა</h2><p>${date}</p>
  <h2>აღწერა</h2><p>ლიბერთი ბანკი აცხადებს ვაკანსიას. კანდიდატს ევალება ფულადი ოპერაციების შესრულება.</p>
  <ul><li>საოფისე პროგრამების ცოდნა</li><li>დეტალებზე ორიენტირებულობა</li></ul>
  <p>რეზიუმე გამოაგზავნეთ <a href="mailto:jobs@lb.ge">ელფოსტაზე</a>.</p></div></div>
  <footer>სხვა პროდუქტის რეკლამა</footer>`;
}

void test('Liberty listing preserves official IDs/URLs and metadata without inventing a posting date', () => {
  const links = listLinks('liberty', listing([item, item]));
  assert.equal(links.length, 1);
  assert.equal(links[0].url, url);
  assert.equal(links[0].externalId, '1193');
  assert.deepEqual(links[0].hints, {
    city: 'თბილისი',
    categoryLabel: 'ბექ-ოფისი',
  });
  assert.deepEqual(liberty.listingInfo(listing([item])), {
    reportedTotal: 1,
    pageSize: 1,
    totalPages: 1,
  });
  assert.deepEqual(getSourceConfig('liberty').hosts, [
    'www.libertybank.ge',
    'libertybank.ge',
  ]);
  assert.deepEqual(listLinks('liberty', listing([])), []);
});

void test('Liberty rejects offsite, ambiguous and malformed listing identities', () => {
  for (const invalid of [
    'https://jobs.ge/ge/?view=jobs&id=1193',
    url.replace('www.libertybank.ge', 'libertybank.ge.evil.test'),
    url.replace('https:', 'http:'),
    url.replace('www.', 'user@www.'),
    url.replace('www.libertybank.ge', 'www.libertybank.ge:444'),
    url.replace('/ka/', '/en/'),
    url + '/extra',
    url + '?id=22',
    url + '#form',
  ])
    assert.equal(externalId('liberty', invalid), null, invalid);
  for (const invalid of [
    { ...item, id: 88 },
    { ...item, url: 'https://evil.test/1193' },
    { ...item, endDate: '31 თებერვალი, 2026' },
    { ...item, title: '' },
  ])
    assert.throws(() => listLinks('liberty', listing([invalid])));
  assert.throws(() =>
    listLinks('liberty', '<script>window.vacancies = runCode();</script>'),
  );
  assert.throws(() =>
    listLinks('liberty', '<div>temporarily unavailable</div>'),
  );
});

void test('Liberty detail preserves full description, contact, deadline and job facts', () => {
  const job = parseDetail('liberty', detail(), url, {
    categoryLabel: 'ბექ-ოფისი',
  });
  assert.equal(job.company, 'ლიბერთი ბანკი');
  assert.equal(job.source, 'libertybank.ge');
  assert.equal(job.city, 'თბილისი');
  assert.equal(job.datePosted, '');
  assert.equal(job.deadline, '2026-11-11');
  assert.equal(job.logoUrl, 'https://www.libertybank.ge/m/i/logo-ka@2x.png?1');
  assert.match(job.description, /jobs@lb.ge/);
  assert.match(job.description, /• დეტალებზე ორიენტირებულობა/);
  assert.doesNotMatch(job.description, /სხვა პროდუქტის რეკლამა|ბოლო ვადა/);
  assert.ok(
    job.facts?.some(
      (f) => f.label === 'სამუშაო საათები' && f.value === 'სტანდარტული',
    ),
  );
  assert.ok(publishable(job, 'liberty', url, '2026-10-29'));
  assert.equal(publishable(job, 'liberty', url, '2026-11-12'), null);
  assert.throws(() =>
    parseDetail('liberty', detail(url.replace('/1193/', '/44/')), url),
  );
  assert.throws(() =>
    parseDetail('liberty', detail('https://evil.test/1193'), url),
  );
  assert.throws(() => parseDetail('liberty', detail(url, ''), url));
  assert.throws(() =>
    parseDetail('liberty', detail().replace('აღწერა', 'სხვა'), url),
  );
});

void test('only current official Liberty vacancies can be imported without publication dates', () => {
  const job = parseDetail('liberty', detail(), url);
  const reason = (changes: Partial<typeof job>) =>
    importVacancyDateReason({ ...job, ...changes }, '2026-10-29');
  assert.equal(reason({}), null);
  for (const changes of [
    { source: 'hr.ge' },
    { url: 'https://www.hr.ge/announcement/1193' },
    { deadline: '' },
    { deadline: '2026-02-30' },
    { deadline: '2026-10-28' },
  ])
    assert.equal(reason(changes), 'undated');
  assert.equal(reason({ datePosted: '2026-10-25' }), null);
  assert.equal(reason({ datePosted: '2026-10-24' }), 'outside_window');
  assert.equal(reason({ datePosted: '2026-10-30' }), 'outside_window');
});

void test('Liberty uses explicitly named workplace towns without guessing region capitals', () => {
  const page = (title: string, region: string) =>
    detail()
      .replace(item.title, title)
      .replace('<p>თბილისი</p>', `<p>${region}</p>`);
  const mixed = parseDetail(
    'liberty',
    page('ურთიერთობის მენეჯერი - ქუთაისი, სამტრედია', 'იმერეთი'),
    url,
  );
  assert.equal(mixed.city, 'ქუთაისი, სამტრედია');
  assert.ok(
    mixed.facts?.some(
      (f) => f.label === 'ადგილმდებარეობა' && f.value === 'იმერეთი',
    ),
  );
  const regional = parseDetail(
    'liberty',
    page('მოლარე-ოპერატორი - იმერეთი', 'იმერეთი'),
    url,
  );
  assert.equal(regional.city, 'იმერეთი');
  const nationwide = parseDetail(
    'liberty',
    page('მოლარე-ოპერატორი - თბილისი და რეგიონები', 'სხვადასხვა'),
    url,
  );
  assert.equal(nationwide.city, 'თბილისი და რეგიონები');
});

void test('official Liberty source never fetches third-party employer attachments', async (t) => {
  const job = {
    ...parseDetail('liberty', detail(), url),
    applicationLinks: [
      { label: 'Apply', url: 'https://app.helio-ai.com/apply/abcd' },
    ],
  };
  const fetch = t.mock.method(globalThis, 'fetch', () => {
    throw Error('Unexpected external request');
  });
  assert.equal(await completeDescription(job), job);
  assert.equal(fetch.mock.callCount(), 0);
});
