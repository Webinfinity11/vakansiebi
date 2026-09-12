import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// The adapter module imports the shared UnavailableVacancy class back from the index, so the
// index must be the first of the two to load, exactly as the worker loads it.
import {
  parseDetail,
  listLinks,
  externalId,
  detailRequestUrl,
  UnavailableVacancy,
} from '../worker/adapters';
import { worknet } from '../worker/adapters/worknet';
import { readDiscoveryInfo, discoveryListingUrl } from '../worker/discovery';
import { vacancySchema } from '../lib/vacancy-schema';
import { categories } from '../lib/types';

const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/worknet/${name}`, import.meta.url), 'utf8');
const publicUrl = 'https://worknet.moh.gov.ge/ka/vacancies/28847';
const detail = () => JSON.parse(fixture('detail.json')) as Record<string, unknown>;

void test('worknet ids come only from the public vacancy page URL', () => {
  assert.equal(externalId('worknet', publicUrl), '28847');
  assert.equal(externalId('worknet', publicUrl + '/'), '28847');
  for (const url of [
    'https://worknet-api.moh.gov.ge/api/Vacancy/Id?Id=28847',
    'https://worknet.moh.gov.ge/en/vacancies/28847',
    'https://worknet.moh.gov.ge/ka/vacancies/',
    'https://worknet.moh.gov.ge/ka/vacancies/28847/apply',
    'https://worknet.moh.gov.ge/ka/organizations/28847',
    'https://evil.test/ka/vacancies/28847',
  ])
    assert.equal(externalId('worknet', url), null, url);
});
void test('worknet detail is fetched from the API for a public URL only', () => {
  assert.equal(
    detailRequestUrl('worknet', publicUrl),
    'https://worknet-api.moh.gov.ge/api/Vacancy/Id?Id=28847',
  );
  assert.throws(() =>
    worknet.detailRequestUrl('https://worknet-api.moh.gov.ge/api/Vacancy/Id?Id=28847'),
  );
  assert.throws(() => worknet.detailRequestUrl('https://worknet.moh.gov.ge/ka/vacancies'));
  assert.equal(
    discoveryListingUrl('worknet', 2),
    'https://worknet-api.moh.gov.ge/api/Vacancy/All?pageIndex=2&pageSize=100',
  );
});
void test('worknet listing links are public URLs of active vacancies with hints', () => {
  const links = listLinks('worknet', fixture('list.json'));
  assert.deepEqual(
    links.map((l) => [l.externalId, l.url]),
    [
      ['28847', publicUrl],
      ['28846', 'https://worknet.moh.gov.ge/ka/vacancies/28846'],
    ],
  );
  assert.deepEqual(links[0].hints, {
    salaried: true,
    categoryLabel: 'გაყიდვების კონსულტანტი',
  });
  assert.equal(links[1].hints?.salaried, false);
  assert.deepEqual(listLinks('worknet', 'not json'), []);
  assert.deepEqual(listLinks('worknet', '{"items":"x"}'), []);
});
void test('worknet listing info reads the reported totals within bounds', () => {
  assert.deepEqual(readDiscoveryInfo('worknet', fixture('list.json')), {
    reportedTotal: 9707,
    pageSize: 4,
    totalPages: 98,
  });
  assert.deepEqual(worknet.listingInfo('<html>'), {
    reportedTotal: null,
    pageSize: null,
    totalPages: null,
  });
  assert.deepEqual(
    worknet.listingInfo('{"totalCount":-5,"totalPages":5000,"items":{}}'),
    { reportedTotal: null, pageSize: null, totalPages: null },
  );
  assert.deepEqual(worknet.listingInfo('{"totalCount":1e9,"totalPages":"9"}'), {
    reportedTotal: null,
    pageSize: null,
    totalPages: null,
  });
});
void test('worknet detail becomes a public record without private employer data', () => {
  const job = parseDetail('worknet', fixture('detail.json'), publicUrl, {
    salaried: true,
    categoryLabel: 'გაყიდვების კონსულტანტი',
  });
  assert.equal(job.title, 'გაყიდვების მენეჯერი');
  assert.equal(job.company, 'შპს გლობალ ფროფერთი ბუტიკ');
  assert.equal(job.city, 'ბათუმი');
  assert.equal(job.salary, '1500 ₾ / თვე');
  assert.equal(job.salaryMin, 1500);
  assert.equal(job.currency, 'GEL');
  assert.equal(job.salaryPeriod, 'თვე');
  assert.equal(job.deadline, '2026-09-25');
  assert.equal(job.datePosted, '2026-09-11');
  assert.equal(job.mode, 'ჰიბრიდული');
  assert.equal(job.employmentType, 'სრული განაკვეთი');
  // The shared title classifier owns the verdict; the adapter only has to leave it a clean title.
  assert.ok(categories.includes(job.category as (typeof categories)[number]));
  assert.equal(job.source, 'worknet.moh.gov.ge');
  assert.equal(job.url, publicUrl);
  assert.equal(job.logoUrl, '');
  assert.deepEqual(job.applicationLinks, []);
  const fact = (label: string) => job.facts?.find((f) => f.label === label)?.value;
  assert.equal(fact('პროფესია'), 'გაყიდვების კონსულტანტი');
  assert.equal(fact('სამუშაო ადგილი'), 'ბათუმი, გორგილაძის ქ.N113');
  assert.equal(fact('ვაკანსიების რაოდენობა'), '3');
  assert.equal(fact('სამუშაო გრაფიკი'), 'გრაფიკი შეთანხმებით');
  assert.equal(fact('დასაქმების ფორმა'), 'სრული');
  assert.equal(fact('გამოცდილება'), '1 წელი');
  assert.equal(fact('ენები'), 'უკრაინული (თავისუფლად)');
  assert.equal(fact('ბენეფიტები'), undefined);
  assert.ok(job.description.startsWith('გაყიდვების მენეჯერი. საჭიროა უკრაინული ენის ცოდნა.'));
  assert.match(job.description, /\nუნარები: თანამშრომლობა, ტოლერანტულობა, კეთილსინდისიერება$/);
  assert.match(job.description, /\nხელფასი: 1500 ₾ \/ თვე\n/);
  const serialized = JSON.stringify(job);
  for (const secret of ['000000000', 'ტესტ პიროვნება', 'identificationCode', '445817135'])
    assert.ok(!serialized.includes(secret), secret);
  assert.ok(vacancySchema.safeParse(job).success);
});
void test('worknet salary falls back to the bracket, then to the agreed marker', () => {
  const withSalary = (exactSalary: unknown, salaryRangeIds: number[]) =>
    parseDetail(
      'worknet',
      JSON.stringify({ ...detail(), exactSalary, salaryRangeIds }),
      publicUrl,
    );
  const bracket = withSalary('1300-1700+ბონუსი', [12]);
  assert.equal(bracket.salary, '1501–2000 ₾ / თვე');
  assert.equal(bracket.salaryMin, 1501);
  assert.match(bracket.description, /\nხელფასი: 1300-1700\+ბონუსი\n/);
  const agreed = withSalary('შეთანხმებით', [7]);
  assert.equal(agreed.salary, 'შეთანხმებით');
  assert.equal(agreed.salaryMin, null);
  assert.equal(agreed.currency, '');
  // Free text is kept as written; the shared pay parser then reads the daily lari figure from it.
  const typed = withSalary('30 ლარი დღეში', []);
  assert.equal(typed.salary, '30 ლარი დღეში');
  assert.equal(typed.salaryMin, 30);
  assert.equal(typed.currency, 'GEL');
  assert.equal(typed.salaryPeriod, 'დღე');
  const untyped = withSalary('გამომუშავებით', []);
  assert.equal(untyped.salary, 'გამომუშავებით');
  assert.equal(untyped.salaryMin, null);
  assert.equal(withSalary(null, [7]).salary, 'შეთანხმებით');
});
void test('worknet city comes from the street, else the sampled region, else nothing', () => {
  const withLocation = (locations: unknown) =>
    parseDetail('worknet', JSON.stringify({ ...detail(), locations }), publicUrl).city;
  assert.equal(withLocation([{ regionId: 97, municipalityId: [101], street: 'ქ.გორი' }]), 'გორი');
  assert.equal(withLocation([{ regionId: 19, street: 'ყვარლის სატყეო' }]), 'კახეთი');
  assert.equal(withLocation([{ regionId: 28, street: 'ოქროყანა' }]), 'თბილისი');
  assert.equal(withLocation([{ regionId: 4040, street: 'ცენტრალური ქუჩა' }]), '');
  assert.equal(withLocation([]), '');
  // Two streets in two cities are a multi-location vacancy; the region is not narrowed either.
  assert.equal(
    withLocation([
      { regionId: 11, street: 'მარნეული' },
      { regionId: 11, street: 'რუსთავი' },
    ]),
    'ქვემო ქართლი',
  );
});
void test('worknet rejects inactive, canceled and mismatched vacancies', () => {
  assert.throws(
    () =>
      parseDetail('worknet', JSON.stringify({ ...detail(), isCanceled: true }), publicUrl),
    UnavailableVacancy,
  );
  assert.throws(
    () =>
      parseDetail('worknet', JSON.stringify({ ...detail(), vacancyStatusId: 3 }), publicUrl),
    UnavailableVacancy,
  );
  assert.throws(
    () =>
      parseDetail(
        'worknet',
        fixture('detail.json'),
        'https://worknet.moh.gov.ge/ka/vacancies/28848',
      ),
    /mismatched/,
  );
  assert.throws(() => parseDetail('worknet', '<html>', publicUrl), /mismatched/);
  assert.throws(() => parseDetail('worknet', '[]', publicUrl), /mismatched/);
});
