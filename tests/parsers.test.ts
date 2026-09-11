import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseDetail,
  listLinks,
  externalId,
  cleanText,
  fingerprint,
  georgianDate,
  additionalListing,
  tbilisiDate,
  configs,
  getSourceConfig,
  UnavailableVacancy,
} from '../worker/adapters';
import { validateUrl } from '../worker/http';
void test('deduplicates listing links and rejects links to other origins', () => {
  const result = listLinks(
    'hr',
    '<a href="/announcement/123/a">A</a><a href="/announcement/123/a">A</a><a href="https://evil.test/announcement/456/a">X</a><a href="/announcement/favorites">Y</a>',
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].externalId, '123');
});
void test('URL allowlist rejects credentials, ports and unrelated hosts', () => {
  for (const url of [
    'http://www.hr.ge/',
    'https://www.hr.ge.evil.test/',
    'https://user:pass@www.hr.ge/',
    'https://www.hr.ge:444/',
    'https://127.0.0.1/',
  ])
    assert.throws(() => validateUrl('hr', url));
  assert.equal(externalId('jobs', 'https://jobs.ge/ge/?view=jobs&id=42'), '42');
});
void test('source HTML becomes plain text without scripts, retaining paragraphs', () =>
  assert.equal(
    cleanText('<p>First</p><script>bad()</script><p>Second &amp; third</p>'),
    'First\nSecond & third',
  ));
void test('HR only uses the requested announcement and respects hidden salary', () => {
  const announcement = {
    announcementId: 123,
    title: 'ოფისის ასისტენტი',
    customerName: 'კომპანია',
    addresses: ['თბილისი'],
    publishDate: '2026-09-07',
    deadlineDate: '2026-10-07',
    showSalary: false,
    salaryFrom: 9000,
  };
  const html = `<script id="ng-state" type="application/json">${JSON.stringify({ a: { b: { data: { announcement } } } })}</script><div class="description">${'გამოცდილი თანამშრომლის ვაკანსია. '.repeat(3)}</div>`;
  const job = parseDetail(
    'hr',
    html,
    'https://www.hr.ge/announcement/123/test',
  );
  assert.equal(job.title, announcement.title);
  assert.equal(job.salary, '');
  assert.equal(job.salaryMin, null);
  assert.equal(job.deadline, '2026-10-07');
});
void test('Samushao parses JSON-LD with explicit pay period and currency', () => {
  const data = {
    '@type': 'JobPosting',
    title: 'Developer',
    description:
      '<p>' + 'Work with a small engineering team. '.repeat(3) + '</p>',
    hiringOrganization: { name: 'Team' },
    baseSalary: {
      currency: 'USD',
      value: { minValue: 1000, maxValue: 2000, unitText: 'MONTH' },
    },
    jobLocationType: 'TELECOMMUTE',
    validThrough: '2026-10-04T00:00',
  };
  const job = parseDetail(
    'samushao',
    `<script type="application/ld+json">${JSON.stringify(data)}</script>`,
    'https://samushao.ge/vakansia/developer-123',
  );
  assert.equal(job.currency, 'USD');
  assert.equal(job.salaryPeriod, 'თვე');
  assert.equal(job.salaryMin, 1000);
  assert.equal(job.mode, 'დისტანციური');
});
void test('missing description fails instead of importing a navigation page', () =>
  assert.throws(() =>
    parseDetail(
      'hr',
      '<title>Jobs</title>',
      'https://www.hr.ge/announcement/123/test',
    ),
  ));
void test('Georgian date parser validates dates and explicit year', () => {
  assert.equal(georgianDate('04 ოქტომბერი', 2026), '2026-10-04');
  assert.equal(georgianDate('31 თებერვალი', 2026), '');
  assert.equal(georgianDate('01 იანვარი 2027', 2026), '2027-01-01');
});
void test('duplicate fingerprint folds punctuation but keeps city differences', () => {
  assert.equal(
    fingerprint({
      title: 'Office - Manager',
      company: 'ACME',
      city: 'თბილისი',
    }),
    fingerprint({ title: 'office manager', company: 'Acme', city: 'თბილისი' }),
  );
  assert.notEqual(
    fingerprint({ title: 'Manager', company: 'ACME', city: 'თბილისი' }),
    fingerprint({ title: 'Manager', company: 'ACME', city: 'ბათუმი' }),
  );
});

void test('new source detail URLs are allowlisted and listing pages rejected', () => {
  assert.equal(
    externalId('ss', 'https://jobs.ss.ge/ka/details/designer-123'),
    '123',
  );
  assert.equal(externalId('ss', 'https://jobs.ss.ge/ka/l/vacancies'), null);
  assert.equal(
    externalId(
      'hrgov',
      'https://vacancy.hr.gov.ge/JobProvider/UserOrgVaks/Details/42?active=1',
    ),
    '42',
  );
  assert.equal(
    externalId(
      'hrgov',
      'https://www.hr.gov.ge/JobProvider/UserOrgVaks/Details/42',
    ),
    null,
  );
});
void test('SS parses matching vacancy, preserving currency, period and company-specific logo', () => {
  const d = {
    id: 123,
    jobsDealType: 1,
    title: { ka: 'დიზაინერი' },
    description: {
      ka: '<p>კომპანია ეძებს გამოცდილ დიზაინერს საინტერესო პროექტებში სამუშაოდ.</p>',
    },
    publisherName: 'Studio',
    logo: 'https://static.ss.ge/company.jpg',
    address: { cityTitle: { ka: 'თბილისი' } },
    currencyId: 1,
    salaryFrom: 100,
    salaryTo: 150,
    monthOrDayType: 1,
    workingSchedule: 1,
    workingFormat: 2,
    startDate: '2026-09-01',
    endDate: '2026-09-30',
    resumeLink: 'https://example.com/apply',
  };
  const html = (detail: typeof d) =>
    `<script id="__NEXT_DATA__">${JSON.stringify({ props: { pageProps: { detailsInitData: detail } } })}</script>`;
  const url = 'https://jobs.ss.ge/ka/details/designer-123';
  const j = parseDetail('ss', html(d), url);
  assert.equal(j.source, 'jobs.ss.ge');
  assert.equal(j.salaryMin, 100);
  assert.equal(j.salaryPeriod, 'დღე');
  assert.equal(j.mode, 'ჰიბრიდული');
  assert.equal(j.logoUrl, d.logo);
  assert.equal(j.applicationLinks?.[0].url, d.resumeLink);
  assert.throws(() => parseDetail('ss', html({ ...d, id: 124 }), url));
  assert.throws(() => parseDetail('ss', html({ ...d, jobsDealType: 2 }), url));
  assert.equal(
    parseDetail('ss', html({ ...d, currencyId: 999 }), url).salary,
    '',
  );
});
void test('public service parser uses visible labelled fields, including public vacancy contacts', () => {
  const html =
    '<p id="vacancyActiveDateLast" style="visibility:hidden">2026/10/01</p><form id="regForm"><input id="ID" value="42"><dl><dt>პოზიციის დასახელება</dt><dd>მთავარი სპეციალისტი</dd><dt>ორგანიზაცია</dt><dd>სააგენტო</dd><dt>სამსახურის ადგილმდებარეობა</dt><dd>გორი</dd><dt>განცხადების ბოლო ვადა</dt><dd>30.09.2026</dd><dt>თანამდებობრივი სარგო:</dt><dd>2080 ლარი</dd><dt>ფუნქციები</dt><dd>კანდიდატი შეასრულებს ადმინისტრაციულ სამუშაოს და მოამზადებს ანგარიშებს.</dd><dt>საკონტაქტო ტელეფონები</dt><dd>555000000</dd></dl></form>';
  const j = parseDetail(
    'hrgov',
    html,
    'https://vacancy.hr.gov.ge/JobProvider/UserOrgVaks/Details/42?active=1',
  );
  assert.equal(j.deadline, '2026-09-30');
  assert.equal(j.company, 'სააგენტო');
  assert.equal(j.salaryMin, 2080);
  assert.equal(j.salaryPeriod, '');
  assert.equal(j.logoUrl, '');
  assert.ok(
    j.facts?.some(
      (f) => f.label === 'საკონტაქტო ტელეფონები' && f.value === '555000000',
    ),
  );
  assert.throws(() =>
    parseDetail(
      'hrgov',
      html,
      'https://vacancy.hr.gov.ge/JobProvider/UserOrgVaks/Details/43',
    ),
  );
});
void test('Samushao rejects concatenated salary, visible currency mismatch and impossible dates', () => {
  const data = {
    '@type': 'JobPosting',
    title: 'Developer',
    description:
      'Join our engineering team and build useful products for customers.',
    validThrough: '2026-02-31',
    baseSalary: {
      currency: 'GEL',
      value: { minValue: 6000120000000, unitText: 'MONTH' },
    },
  };
  const make = (d: typeof data, visible = '') =>
    `<script type="application/ld+json">${JSON.stringify(d)}</script><dl><dt>ხელფასი</dt><dd>${visible}</dd></dl>`;
  const url = 'https://samushao.ge/vakansia/developer-123';
  const j = parseDetail('samushao', make(data), url);
  assert.equal(j.salary, '');
  assert.equal(j.deadline, '');
  assert.ok(j.warnings?.some((w) => w.includes('ხელფას')));
  const conflict = parseDetail(
    'samushao',
    make(
      {
        ...data,
        baseSalary: {
          currency: 'GEL',
          value: { minValue: 2000, unitText: 'MONTH' },
        },
      },
      '2000 USD',
    ),
    url,
  );
  assert.equal(conflict.salaryMin, null);
});
void test('Jobs sidebar client images cannot become the vacancy company logo', () => {
  const html =
    '<table><tr><td class="dtitle"><b>Designer</b></td><td class="dtitle"><b>Studio</b></td><td class="dtitle"><b>01 სექტემბერი</b><b>30 სექტემბერი</b></td></tr><tr><td><img src="/data/clients/unrelated-company.gif"><p>We are seeking an experienced designer to join our growing team.</p></td></tr></table>';
  assert.equal(
    parseDetail('jobs', html, 'https://jobs.ge/ge/?view=jobs&id=42').logoUrl,
    '',
  );
});

void test('listing traversal rotates one observed page and never follows offsite links', () => {
  const html =
    '<a href="?page=2">2</a><a href="?page=184">Last</a><a href="https://evil.test/?page=999">Bad</a>';
  assert.equal(
    additionalListing('ss', html, 0),
    'https://jobs.ss.ge/ka/l/vacancies?page=2',
  );
  assert.equal(
    additionalListing('ss', html, 182),
    'https://jobs.ss.ge/ka/l/vacancies?page=184',
  );
  assert.equal(
    additionalListing('ss', html, 183),
    'https://jobs.ss.ge/ka/l/vacancies?page=2',
  );
  assert.equal(
    additionalListing('hrgov', '<a href="/?pageNo=41">Last</a>', 0),
    'https://vacancy.hr.gov.ge/?pageNo=2',
  );
});

void test('Georgian calendar boundaries use Tbilisi time, including the new year', () => {
  assert.equal(tbilisiDate(new Date('2026-12-31T20:01:00Z')), '2027-01-01');
  assert.equal(tbilisiDate(new Date('2026-09-07T20:01:00Z')), '2026-09-08');
  assert.equal(tbilisiDate(new Date('2026-09-07T19:59:00Z')), '2026-09-07');
});
void test('SS withholds reversed salary ranges and never copies private profile/contact fields', () => {
  const d = {
    id: 123,
    jobsDealType: 1,
    title: { ka: 'Developer' },
    description: {
      ka: 'Join our development team to build great tools for local customers.',
    },
    publisherName: 'Studio',
    salaryFrom: 2000,
    salaryTo: 1000,
    currencyId: 1,
    monthOrDayType: 0,
    email: 'private@example.com',
    phones: ['555000000'],
    userInfo: { name: 'Private name', email: 'hidden@example.com' },
    resumeFileUrl: 'https://example.com/private-cv.pdf',
  };
  const html = `<script id="__NEXT_DATA__">${JSON.stringify({ props: { pageProps: { detailsInitData: d } } })}</script>`;
  const j = parseDetail(
    'ss',
    html,
    'https://jobs.ss.ge/ka/details/developer-123',
  );
  assert.equal(j.salary, '');
  assert.equal(j.salaryMin, null);
  assert.ok(j.warnings?.some((w) => w.includes('ხელფას')));
  assert.equal(j.company, 'Studio');
  assert.ok(!JSON.stringify(j).includes('private'));
  assert.ok(!JSON.stringify(j).includes('hidden@example.com'));
  assert.equal(j.applicationLinks?.length, 0);
});

void test('retired competitor cannot be discovered by active configs or fetched', () => {
  assert.ok(!('samushao' in configs));
  assert.throws(() => getSourceConfig('samushao'), /retired/);
  assert.throws(
    () => validateUrl('samushao', 'https://samushao.ge/'),
    /retired/,
  );
});

void test('SS retains duties and requirements supplied as plain strings', () => {
  const detail = {
    id: 123,
    jobsDealType: 1,
    title: { ka: 'მზარეული' },
    publisherName: 'რესტორანი',
    description: { ka: 'მზარეულის ვაკანსია.' },
    duties:
      'კერძების მომზადება განსაზღვრული რეცეპტისა და კალკულაციის მიხედვით.',
    requirements: 'მინიმუმ 1 წლიანი გამოცდილება მზარეულის პოზიციაზე.',
  };
  const html = `<script id="__NEXT_DATA__">${JSON.stringify({ props: { pageProps: { detailsInitData: detail } } })}</script>`;
  const result = parseDetail(
    'ss',
    html,
    'https://jobs.ss.ge/ka/details/mzareuli-123',
  );
  assert.ok(result.description.includes(detail.duties));
  assert.ok(result.description.includes(detail.requirements));
});

void test('SS pagination reaches distant pages using the public result count', () => {
  const html = `<a href="/ka/l/vacancies?page=2">2</a><a href="/ka/l/vacancies?page=3">3</a>
    <script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { searchInitData: { result: { items: Array(25).fill({}), totalCount: 2452 } } } } })}</script>`;
  assert.equal(
    additionalListing('ss', html, 70),
    'https://jobs.ss.ge/ka/l/vacancies?page=72',
  );
  assert.equal(
    additionalListing('ss', html, 98),
    'https://jobs.ss.ge/ka/l/vacancies?page=2',
  );
  assert.equal(
    additionalListing('ss', '<script id="__NEXT_DATA__">broken</script>', 70),
    null,
  );
});

const gxCategory =
  'https://gancxadebebi.ge/ka/%E1%83%92%E1%83%90%E1%83%9C%E1%83%AA%E1%83%AE%E1%83%90%E1%83%93%E1%83%94%E1%83%91%E1%83%94%E1%83%91%E1%83%98/%E1%83%93%E1%83%90%E1%83%A1%E1%83%90%E1%83%A5%E1%83%9B%E1%83%94%E1%83%91%E1%83%90-%E1%83%A1%E1%83%90%E1%83%9B%E1%83%A3%E1%83%A8%E1%83%90%E1%83%9D-3/%E1%83%95%E1%83%90%E1%83%99%E1%83%90%E1%83%9C%E1%83%A1%E1%83%98%E1%83%90-25';
const gxVacancyUrl = gxCategory + '/amwis-operatori-GEO1514848';
const gxPage = (id = 'GEO1514848') =>
  `<div class="am" id="a1514848" itemscope itemtype="http://schema.org/Product">
     <div class="av"><span>თბილისი</span></div>
     <div class="ah">
       <h1 class="at" itemprop="name">ამწის ოპერატორი</h1>
       <div class="ad">აგვისტო 25, 2026</div>
       <div class="ar" itemprop="sku">${id}</div>
     </div>
     <div class="atx" itemprop="description">კომპანიაში გვჭირდება კოშკურა ამწის ოპერატორი.<br />სამუშაო საათები: 09:00 - 18:00<br />ანაზღაურება: დღეში - 125 ლარი.</div>
     <ul class="dtl dtlemploi">
       <li class="dtl_sexe"><span>სქესი :</span> მამაკაცი</li>
       <li class="dtl_experience"><span>გამოცდილება :</span> &lt; 1 წელი</li>
     </ul>
   </div>
   <div class="am" id="a999" itemscope><div class="av"><span>ქუთაისი</span></div>
     <div class="ah"><h1 class="at">სხვისი განცხადება</h1><div class="ar">GEO999</div></div>
     <div class="atx">სულ სხვა განცხადების ტექსტი, რომელიც იმავე გვერდზეა ჩამონათვალში.</div>
   </div>`;

void test('the classified board collects only its vacancy category', () => {
  assert.equal(externalId('gancxadebebi', gxVacancyUrl), '1514848');
  for (const rejected of [
    gxCategory.replace('-25', '-24') + '/vedzeb-samsakhurs-GEO1',
    'https://gancxadebebi.ge/ka/%E1%83%92%E1%83%90%E1%83%9C%E1%83%AA%E1%83%AE%E1%83%90%E1%83%93%E1%83%94%E1%83%91%E1%83%94%E1%83%91%E1%83%98/-GEO1454103',
    'https://evil.test' + new URL(gxVacancyUrl).pathname,
  ])
    assert.equal(externalId('gancxadebebi', rejected), null);
});

void test('a private advertisement keeps its own text and never borrows a neighbouring one', () => {
  const v = parseDetail('gancxadebebi', gxPage(), gxVacancyUrl);
  assert.equal(v.title, 'ამწის ოპერატორი');
  assert.equal(v.city, 'თბილისი');
  assert.equal(v.datePosted, '2026-08-25');
  assert.equal(v.company, '');
  assert.match(v.description, /კოშკურა ამწის ოპერატორი/);
  assert.doesNotMatch(v.description, /სხვა განცხადების ტექსტი/);
  // The source's own labelled fields are kept; pay excerpts are added by the enricher.
  assert.deepEqual(v.facts?.map((f) => f.label).slice(0, 2), [
    'სქესი',
    'გამოცდილება',
  ]);
  assert.equal(v.salary, 'დღეში - 125 ლარი.');
  assert.throws(
    () => parseDetail('gancxadebebi', gxPage('GEO7777777'), gxVacancyUrl),
    UnavailableVacancy,
  );
});

void test('private advertisements without an employer never pair up as duplicates', () => {
  const base = {
    title: 'მზარეული',
    company: '',
    city: 'თბილისი',
    source: 'gancxadebebi.ge',
  };
  assert.notEqual(
    fingerprint({ ...base, url: 'https://gancxadebebi.ge/a-GEO1' }),
    fingerprint({ ...base, url: 'https://gancxadebebi.ge/b-GEO2' }),
  );
  // Employers on the existing sources still match across different listing URLs.
  assert.equal(
    fingerprint({
      title: 'მზარეული',
      company: 'კომპანია',
      city: 'თბილისი',
      source: 'hr.ge',
      url: 'https://www.hr.ge/announcement/1/a',
    }),
    fingerprint({
      title: 'მზარეული',
      company: 'კომპანია',
      city: 'თბილისი',
      source: 'jobs.ge',
      url: 'https://jobs.ge/ge/?view=jobs&id=2',
    }),
  );
});
