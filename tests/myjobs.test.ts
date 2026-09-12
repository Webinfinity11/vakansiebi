import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// The index must load first: the module imports `UnavailableVacancy` back from it.
import {
  parseDetail,
  externalId,
  listLinks,
  detailRequestUrl,
  UnavailableVacancy,
} from '../worker/adapters';
import { myjobs } from '../worker/adapters/myjobs';

const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/myjobs/${name}`, import.meta.url), 'utf8');
const detailJson = fixture('detail.json');
const detailHtml = fixture('detail.html');
const listJson = fixture('list.json');
const url = 'https://myjobs.ge/ka/vacancy/21988';
/** The API detail with a few fields changed, serialised the way the API sends it. */
const variant = (patch: Record<string, unknown>) =>
  JSON.stringify({ data: { ...JSON.parse(detailJson).data, ...patch } });

void test('myjobs ids come from both public URL forms but never the API host', () => {
  assert.equal(externalId('myjobs', url), '21988');
  assert.equal(
    externalId(
      'myjobs',
      'https://myjobs.ge/ka/vacancy/20801/gaqidvebi/vachroba/gaqidvebis-carmomadgeneli/stazhireba',
    ),
    '20801',
  );
  assert.equal(
    externalId('myjobs', 'https://www.myjobs.ge/ka/vacancy/7/'),
    '7',
  );
  assert.equal(
    externalId('myjobs', 'https://api.myjobs.ge/api/ka/public/vacancies/21988'),
    null,
  );
  assert.equal(
    externalId('myjobs', 'https://myjobs.ge/ka/company/21988'),
    null,
  );
});
void test('myjobs public URLs map to the API detail request', () => {
  assert.equal(
    detailRequestUrl('myjobs', url + '/momsaxure-personali/sxva/slug'),
    'https://api.myjobs.ge/api/ka/public/vacancies/21988',
  );
  assert.throws(() =>
    myjobs.detailRequestUrl('https://myjobs.ge/ka/vacancies'),
  );
  assert.throws(() => myjobs.detailRequestUrl('not a url'));
  assert.equal(
    myjobs.listingUrl(3),
    'https://api.myjobs.ge/api/ka/public/vacancies?page=3',
  );
});
void test('myjobs listing yields active numeric ids once, with city and salary hints', () => {
  const links = listLinks('myjobs', listJson);
  assert.deepEqual(
    links.map((l) => [l.externalId, l.url]),
    [
      ['21988', url],
      ['21990', 'https://myjobs.ge/ka/vacancy/21990'],
    ],
  );
  assert.deepEqual(links[0].hints, { city: 'ბათუმი', salaried: true });
  assert.deepEqual(links[1].hints, { salaried: false });
  assert.deepEqual(listLinks('myjobs', '<html>not json</html>'), []);
});
void test('myjobs listing info is bounded and tolerates garbage', () => {
  assert.deepEqual(myjobs.listingInfo(listJson), {
    reportedTotal: 723,
    pageSize: 5,
    totalPages: 73,
  });
  const empty = { reportedTotal: null, pageSize: null, totalPages: null };
  assert.deepEqual(myjobs.listingInfo('<html></html>'), empty);
  assert.deepEqual(myjobs.listingInfo('[1,2]'), empty);
  assert.deepEqual(
    myjobs.listingInfo(
      JSON.stringify({ data: [], meta: { total: 5000000, last_page: 99999 } }),
    ),
    empty,
  );
});
void test('myjobs API JSON and the SSR page parse to the same vacancy', () => {
  const fromApi = parseDetail('myjobs', detailJson, url);
  const fromPage = parseDetail('myjobs', detailHtml, url);
  assert.deepEqual(fromPage, fromApi);
  assert.equal(fromApi.title, 'გაყიდვების კონსულტანტი');
  assert.equal(fromApi.company, 'Storm Vape');
  assert.equal(fromApi.city, 'ბათუმი');
  assert.equal(fromApi.source, 'myjobs.ge');
  assert.equal(fromApi.url, url);
  assert.equal(fromApi.salary, '1200–1500 ₾ / თვე');
  assert.equal(fromApi.salaryMin, 1200);
  assert.equal(fromApi.currency, 'GEL');
  assert.equal(fromApi.salaryPeriod, 'თვე');
  // Posted 22:05 UTC is already the 11th in Tbilisi; the deadline is 30 days on.
  assert.equal(fromApi.datePosted, '2026-09-11');
  assert.equal(fromApi.deadline, '2026-10-11');
  assert.equal(fromApi.mode, 'ადგილზე');
  assert.equal(fromApi.employmentType, 'სრული განაკვეთი');
  assert.equal(fromApi.logoUrl, '');
  assert.deepEqual(fromApi.applicationLinks, []);
  const fact = (label: string) =>
    fromApi.facts?.find((f) => f.label === label)?.value;
  assert.equal(fact('კატეგორია'), 'მომსახურე პერსონალი / სხვა');
  assert.equal(fact('გამოცდილება'), 'უმცროსი (junior), 2 წლამდე');
  assert.equal(fact('ენები'), 'ქართული (მშობლიური), რუსული (თავისუფლად)');
  assert.equal(fact('განათლება'), 'განათლების გარეშე');
  assert.equal(fact('ბენეფიტები'), 'დაზღვევა, ბონუსი');
  assert.match(
    fromApi.description,
    /^ვაკანსია: გაყიდვების კონსულტანტი ვეიპ-შოპში\n/,
  );
  assert.match(fromApi.description, /სამუშაო ადგილი: გონიო\n/);
  assert.match(
    fromApi.description,
    /\n\nკატეგორია: მომსახურე პერსონალი \/ სხვა\n/,
  );
  assert.doesNotMatch(fromApi.description, /<p>|<br>/);
});
void test('myjobs salary follows show_salary and salary_type', () => {
  const hidden = parseDetail('myjobs', variant({ show_salary: 0 }), url);
  assert.equal(hidden.salary, '');
  assert.equal(hidden.salaryMin, null);
  assert.equal(hidden.currency, '');
  const negotiable = parseDetail(
    'myjobs',
    variant({
      salary_type: 'negotiable',
      salary_from: null,
      salary_to: null,
      show_salary: '1',
    }),
    url,
  );
  assert.equal(negotiable.salary, 'შეთანხმებით');
  assert.equal(negotiable.salaryMin, null);
  assert.equal(negotiable.currency, '');
  const daily = parseDetail(
    'myjobs',
    variant({
      salary_type: 'fixed',
      salary_from: '80',
      salary_period: 'daily',
    }),
    url,
  );
  assert.equal(daily.salary, '80 ₾ / დღე');
  assert.equal(daily.salaryMin, 80);
  assert.equal(daily.salaryPeriod, 'დღე');
});
void test('myjobs optional fields degrade to empty values and the recruiter name', () => {
  const job = parseDetail(
    'myjobs',
    variant({
      company: { id: 5, brand_name: null, legal_city_title: 'თბილისი' },
      recruiter_company_name: 'HR Partner',
      country: { id: 1, title: 'საქართველო', city: null },
      job_type: 'hybrid',
      employment_type: 'freelance',
      duration: '400',
      languages: [
        { language_id: 99, level: 'basic' },
        { language_id: 2, level: 'b2' },
      ],
      benefits: [],
      education_levels: null,
      experience_levels: [{ experience_level: 'lead' }],
      work_experiences: [],
    }),
    url,
  );
  assert.equal(job.company, 'HR Partner');
  assert.equal(job.city, '');
  assert.equal(job.mode, 'ჰიბრიდული');
  assert.equal(job.employmentType, '');
  assert.equal(job.deadline, '');
  assert.deepEqual(
    job.facts?.map((f) => f.label),
    ['კატეგორია', 'გამოცდილება', 'ენები'],
  );
  assert.equal(job.facts?.[1].value, 'lead');
  assert.equal(job.facts?.[2].value, 'ინგლისური (b2)');
});
void test('myjobs rejects inactive, mismatched and malformed records', () => {
  assert.throws(
    () => parseDetail('myjobs', variant({ status: 'expired' }), url),
    UnavailableVacancy,
  );
  assert.throws(
    () => parseDetail('myjobs', detailJson, 'https://myjobs.ge/ka/vacancy/1'),
    /mismatched/,
  );
  assert.throws(() => parseDetail('myjobs', '{"data":null}', url), /missing/);
  assert.throws(() => parseDetail('myjobs', '{not json', url), /missing/);
  assert.throws(
    () => parseDetail('myjobs', '<html><body>no state</body></html>', url),
    /missing/,
  );
});
void test('myjobs never stores private contact or counter fields', () => {
  const job = parseDetail(
    'myjobs',
    variant({
      company: {
        id: 1193,
        brand_name: 'Storm Vape',
        vacancy_email: 'owner@example.com',
        user_id: 9848440,
      },
      vacancy_emails: ['apply@example.com'],
      applicants_count: 17,
      view_count: 60,
    }),
    url,
  );
  const stored = JSON.stringify(job);
  assert.doesNotMatch(stored, /owner@example\.com|apply@example\.com/);
  assert.doesNotMatch(stored, /9848440|applicants_count|view_count/);
});
