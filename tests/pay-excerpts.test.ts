import test from 'node:test';
import assert from 'node:assert/strict';
import { payExcerpts } from '../lib/pay-excerpts';
import { visibleFields } from '../worker/visible-fields';
import { enrichVacancy } from '../worker/enrich';
import type { Vacancy } from '../lib/types';
void test('pay extraction retains stage, role, bonuses and net qualifications without summing them', () => {
  const text =
    'ანაზღაურებადი სტაჟირება – 650 ლარი;\nბარისტა-კონსულტანტის ანაზღაურება – 900 ლარი;';
  const pay = visibleFields(text);
  assert.equal(payExcerpts(text).length, 2);
  assert.match(pay.salary, /650/);
  assert.match(pay.salary, /900/);
  assert.equal(pay.salaryMin, null);
  const next = visibleFields(
    'ანაზღაურება:\nფიქსირებული 600-800$ ხელზე ასაღები თანხა + ბონუსი',
  );
  assert.equal(next.salaryMin, 600);
  assert.equal(next.currency, 'USD');
  assert.match(next.salary, /ხელზე/);
  assert.equal(visibleFields('ხელფასი: $1000–$1500 + ბონუსი').salaryMin, 1000);
});
void test('daily rate is different from the frequency of receiving pay', () => {
  const pay = visibleFields('ანაზღაურება დღეში 80 ლარი, (გადახდა თვეში ორჯერ)');
  assert.equal(pay.salaryMin, 80);
  assert.equal(pay.salaryPeriod, 'დღე');
  assert.equal(pay.warning, '');
  assert.match(pay.salary, /თვეში ორჯერ/);
});
void test('labelled pay blocks include position-specific and unlabeled net amounts but exclude unrelated financial figures', () => {
  assert.equal(
    payExcerpts(
      'ანაზღაურება და სამუშაო პირობები:\nდამოკიდებულია კვალიფიკაციაზე:\nIT ტექნიკოსი: 1600-1800 ლარი (ხელზე ასაღები)\nმოთხოვნები:\nსესხები 100000 ლარი',
    ).length,
    1,
  );
  assert.equal(
    payExcerpts('ანაზღაურება და პირობები:\n1100 ლარი (ხელზე ასაღები თანხა)')
      .length,
    1,
  );
  assert.deepEqual(
    payExcerpts(
      'დაამუშავებ 200000 ლარის სესხებს\nრეფერალის ბონუსი: $200\nტრანსპორტის ხარჯი 100 ლარი',
    ),
    [],
  );
});
void test('additive enrichment is idempotent and preserves source identity and known salary', () => {
  const job = {
    title: 'მოლარე',
    company: 'Company',
    city: 'თბილისი',
    category: 'გაყიდვები',
    mode: '',
    source: 'jobs.ge',
    deadline: '2099-01-01',
    datePosted: '2026-09-01',
    description: 'ხელფასი: 1500 ლარი თვეში',
    salary: '',
    salaryMin: null,
    currency: '',
    salaryPeriod: '',
    facts: [],
    url: 'https://example.com/job',
  } as Vacancy;
  const next = enrichVacancy(job);
  assert.equal(next.salaryMin, 1500);
  assert.equal(next.url, job.url);
  assert.equal(job.salary, '');
  assert.deepEqual(enrichVacancy(next), next);
  const known = {
    ...job,
    salary: '1700 ₾ / თვე',
    salaryMin: 1700,
    currency: 'GEL',
    salaryPeriod: 'თვე',
  };
  assert.equal(enrichVacancy(known).salary, known.salary);
});

void test('a pay line from a numbered list loses its number, and an amount keeps its digits', async () => {
  const { payExcerpts } = await import('../lib/pay-excerpts');
  // Mirrors cleanText, which writes "4. " before each item of an <ol>.
  assert.deepEqual(
    payExcerpts('პირობები:\n4. ფიქსირებული ანაზღაურება 1000-1400 ლარი'),
    ['ფიქსირებული ანაზღაურება 1000-1400 ლარი'],
  );
  const kept = payExcerpts('ანაზღაურება: 1.500 ლარი');
  assert.ok(
    kept.some((line) => line.includes('1.500')),
    JSON.stringify(kept),
  );
});
