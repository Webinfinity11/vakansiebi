import test from 'node:test';
import assert from 'node:assert/strict';
import { readSearch, searchParams } from '../lib/search-state';
import { subcategories, subcategoryFor } from '../lib/subcategories';
import {
  rememberBoard,
  takeBoard,
  clearBoard,
} from '../lib/board-return-cache';
import { breadcrumbs, jobPosting, jsonLd, vacancyUrl } from '../lib/seo';
import type { PublicJob } from '../lib/types';

void test('subcategory survives sharing but cannot escape its parent category', () => {
  const filters = readSearch(
    new URLSearchParams({
      category: 'მომსახურება',
      subcategory: 'service-cleaning',
    }),
  );
  assert.equal(
    readSearch(searchParams(filters)).subcategory,
    'service-cleaning',
  );
  assert.equal(
    readSearch(
      new URLSearchParams({
        category: 'გაყიდვები',
        subcategory: 'service-cleaning',
      }),
    ).subcategory,
    undefined,
  );
  const rule = subcategoryFor('გაყიდვები', 'sales-management')!;
  assert.match('გაყიდვების მენეჯერი', new RegExp(rule.pattern, 'i'));
  assert.doesNotMatch('ოფის მენეჯერი', new RegExp(rule.pattern, 'i'));
});

void test('every taxonomy child survives a shared URL and is cleared for another parent', () => {
  for (const item of subcategories) {
    const params = new URLSearchParams({
      category: item.category,
      subcategory: item.id,
    });
    assert.equal(
      readSearch(searchParams(readSearch(params))).subcategory,
      item.id,
    );
    params.set('category', 'სხვა');
    assert.equal(readSearch(params).subcategory, undefined);
  }
});

void test('return snapshot is bounded, expires and never crosses search contexts', () => {
  const snapshot = {
    key: 'sales',
    page: 1,
    through: 3,
    path: '/',
    jobs: [],
    total: 60,
    pages: 3,
    search: null,
    companyLinksPending: false,
  };
  rememberBoard(snapshot, 1000);
  assert.equal(takeBoard('different', 1, 2000), null);
  assert.equal(takeBoard('sales', 2, 2000), null);
  const restored = takeBoard('sales', 1, 2000);
  assert.equal(restored?.through, 3);
  assert.equal(restored?.companyLinksPending, false);
  assert.equal(takeBoard('sales', 1, 2000), null);
  rememberBoard(snapshot, 1000);
  assert.equal(takeBoard('sales', 1, 121001), null);
  rememberBoard(snapshot);
  clearBoard();
  assert.equal(takeBoard('sales', 1), null);
  rememberBoard({ ...snapshot, jobs: Array(1001).fill({}) });
  assert.equal(takeBoard('sales', 1), null);
});

const job: PublicJob = {
  id: 'a',
  title: 'დეველოპერი',
  company: 'Example',
  city: 'თბილისი',
  category: 'ტექნოლოგიები',
  description: 'პასუხისმგებლობები\nპროგრამული უზრუნველყოფის შექმნა.',
  datePosted: '2026-09-01',
  deadline: '2026-09-30',
  salary: '',
  salaryMin: null,
  currency: '',
  salaryPeriod: '',
  mode: 'ადგილზე',
  url: 'https://example.com/job',
  source: 'hr.ge',
  createdAt: '2026-09-01',
  sources: [],
};
void test('structured vacancies use the real domain and only supported public facts', () => {
  const data = jobPosting(job, '2026-09-14')!;
  assert.equal(data['@type'], 'JobPosting');
  // The published address carries the vacancy's own name, then its identifier.
  assert.equal(
    decodeURIComponent(data.url),
    'https://jobx.ge/vacancies/developeri-a',
  );
  assert.equal(data.validThrough, '2026-09-30T23:59:59+04:00');
  // This fixture publishes no pay, so none is claimed.
  assert.equal('baseSalary' in data, false);
  assert.equal(
    decodeURIComponent(vacancyUrl({ ...job, canonicalId: 'b' })),
    'https://jobx.ge/vacancies/developeri-b',
  );
  for (const patch of [
    { company: 'კერძო განცხადება' },
    { datePosted: '0001-01-01' },
    { datePosted: '2026-02-30' },
    { deadline: '2026-09-13' },
    { description: '' },
  ])
    assert.equal(jobPosting({ ...job, ...patch }, '2026-09-14'), null);
});
void test('the trail a reader walked is published as it is shown', () => {
  const trail = breadcrumbs([
    { name: 'ვაკანსიები', path: '/' },
    { name: 'Example', path: '/companies/example' },
    { name: 'დეველოპერი', path: '/vacancies/a' },
  ]);
  assert.equal(trail['@type'], 'BreadcrumbList');
  assert.deepEqual(
    trail.itemListElement.map((step) => [step.position, step.item]),
    [
      [1, 'https://jobx.ge/'],
      [2, 'https://jobx.ge/companies/example'],
      [3, 'https://jobx.ge/vacancies/a'],
    ],
  );
});
void test('a vacancy without a city of its own still says where the work is', () => {
  type Posting = {
    jobLocation?: { address: Record<string, string> }[];
    jobLocationType?: string;
    applicantLocationRequirements?: unknown;
  };
  const at = (patch: Partial<PublicJob>) =>
    jobPosting({ ...job, ...patch }, '2026-09-14') as Posting;
  const address = (posting: Posting) =>
    (posting.jobLocation || []).map(
      (place) => place.address.addressLocality || place.address.addressCountry,
    );
  assert.deepEqual(address(at({ city: 'თბილისი' })), ['თბილისი']);
  assert.deepEqual(
    address(at({ city: '', description: 'სამუშაო ადგილი ბათუმში.' })),
    ['ბათუმი'],
    'the one city the text names is the location',
  );
  assert.deepEqual(
    address(at({ city: '', description: 'ოფისი თბილისში, ფილიალი ბათუმში.' })),
    ['GE'],
    'two cities in one text is a guess, so only the country is published',
  );
  assert.deepEqual(
    address(at({ city: 'სოფელი შრომა', description: 'სამუშაო.' })),
    ['GE'],
    'a village outside the list keeps the posting, at country level',
  );
  assert.deepEqual(
    address(at({ city: '', facts: [{label: 'მისამართი', value: 'თბილისი, რუსთავი და ქუთაისი'}] })),
    ['თბილისი', 'ქუთაისი', 'რუსთავი'],
    'explicit workplace addresses preserve every named city',
  );
  assert.deepEqual(
    address(at({ city: '', description: 'სამუშაო ადგილი: თბილისი და ბათუმი' })),
    ['თბილისი', 'ბათუმი'],
    'a labelled work address in the description supports multiple cities',
  );
  const home = at({ mode: 'დისტანციური' });
  assert.equal(home.jobLocationType, 'TELECOMMUTE');
  assert.deepEqual(home.applicantLocationRequirements, {
    '@type': 'Country',
    name: 'Georgia',
  });
  assert.deepEqual(
    address(home),
    ['თბილისი'],
    'a remote role with an office keeps the office',
  );
  assert.equal(
    at({ mode: 'დისტანციური', city: '' }).jobLocation,
    undefined,
    'a fully remote role names no place at all',
  );
  assert.ok(
    !jsonLd({ description: '</script><script>alert(1)</script>' }).includes(
      '<',
    ),
  );
});

/* A salary printed beside a job result is a promise, so only what the board
   itself shows is published: one price, one period, nothing estimated. */
void test('pay is published as numbers only where the posting states it', () => {
  const pay = (salary: string, salaryPeriod = '') =>
    (
      jobPosting({ ...job, salary, salaryPeriod }, '2026-09-14') as {
        baseSalary?: {
          currency: string;
          value: Record<string, string | number>;
        };
      }
    ).baseSalary;
  assert.deepEqual(pay('1200 ლარი')?.value, {
    '@type': 'QuantitativeValue',
    value: 1200,
    unitText: 'MONTH',
  });
  assert.deepEqual(pay('900-1200 ლარი')?.value, {
    '@type': 'QuantitativeValue',
    minValue: 900,
    maxValue: 1200,
    unitText: 'MONTH',
  });
  assert.deepEqual(pay('60–80 ₾ / დღე', 'დღე')?.value, {
    '@type': 'QuantitativeValue',
    minValue: 60,
    maxValue: 80,
    unitText: 'DAY',
  });
  // An hour is a period the schema knows; a dollar figure with no period is not.
  assert.deepEqual(pay('10 ლარი საათში')?.value, {
    '@type': 'QuantitativeValue',
    value: 10,
    unitText: 'HOUR',
  });
  assert.equal(pay('$700')?.currency, undefined, 'no period, no claim');
  for (const unstated of [
    'შეთანხმებით',
    'დაახლოებით 1000 ლარი',
    '',
    // A monthly wage of 35 GEL is not one, whoever wrote it.
    '35 ₾ / თვე',
    // Priced by the piece or by the square metre — not a wage for a period.
    '5 ლარი ცალზე',
  ])
    assert.equal(pay(unstated), undefined, unstated);
});

void test('the footer expands to eligible cities and roles and ranks by available jobs', async () => {
  const { landingLinks } = await import('../lib/seo-landing');
  const links = landingLinks([
    { category: null, city: 'ფოთი', trait: null, count: 10 },
    { category: null, city: null, trait: null, role: 'ბარისტა', count: 120 },
    { category: null, city: null, trait: null, role: 'ჟურნალისტი', count: 9 },
  ]);
  assert.equal(links.length, 2);
  assert.match(links[0].label, /ბარისტას/);
  assert.match(links[1].label, /ფოთში/);
});
