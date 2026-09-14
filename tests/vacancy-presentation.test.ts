import test from 'node:test';
import assert from 'node:assert/strict';
import { explicitWorkCity } from '../lib/work-location';
import {
  compactSalary,
  compactSchedule,
  factAlreadyVisible,
} from '../lib/vacancy-presentation';
import { enrichVacancy } from '../worker/enrich';
import type { Vacancy } from '../lib/types';

void test('explicit workplace city accepts Georgian workplace labels and declines ambiguous locations', () => {
  assert.equal(
    explicitWorkCity({
      description:
        'კომპანიის ოფისია თბილისში.\nსამუშაოს ადგილმდებარეობა: ქ. რუსთავი',
      facts: [],
    }),
    'რუსთავი',
  );
  assert.equal(
    explicitWorkCity({ description: 'მისამართი: ბათუმში', facts: [] }),
    'ბათუმი',
  );
  assert.equal(
    explicitWorkCity({
      description: 'სამუშაო ადგილი: თბილისი, რუსთავი',
      facts: [],
    }),
    '',
  );
  assert.equal(
    explicitWorkCity({
      description: 'კომპანია თბილისში და რუსთავში საქმიანობს.',
      facts: [],
    }),
    '',
  );
  assert.equal(
    explicitWorkCity({
      description: 'იურიდიული მისამართი: თბილისი',
      facts: [],
    }),
    '',
  );
  assert.equal(
    explicitWorkCity({
      description: 'მისამართი: რუსთაველის გამზირი 40',
      facts: [],
    }),
    '',
  );
  assert.equal(
    explicitWorkCity({
      description: 'ადგილმდებარეობა: რუსთავი\nსამუშაო ადგილი: ბათუმი',
      facts: [],
    }),
    '',
  );
});
void test('enrichment fills a missing city while respecting existing location and original text', () => {
  const job = {
    description: 'სამუშაოს ადგილმდებარეობა: ქ. რუსთავი',
    city: '',
    salary: '',
    facts: [],
  } as unknown as Vacancy;
  assert.equal(enrichVacancy(job).city, 'რუსთავი');
  assert.equal(enrichVacancy({ ...job, city: 'თბილისი' }).city, 'თბილისი');
  assert.equal(enrichVacancy(job).description, job.description);
});
void test('salary labels keep source qualifiers alongside formatted amounts', () => {
  for (const [source, expected] of [
    [
      'ფიქსირებული ხელფასი (1000 ლარი) + ყოველთვიური ბონუსი',
      'ფიქსირებული ხელფასი (1 000 ₾) + ყოველთვიური ბონუსი',
    ],
    ['2 000 ₾ Net;', '2 000 ₾ ხელზე ასაღები'],
    ['1000–1500 USD gross', '1 000–1 500 USD დარიცხული'],
    ['1000 ლარი - 1500 ლარი', '1 000–1 500 ₾'],
    ['100 ₾ დღეში', '100 ₾ დღეში'],
    ['საათში 15 €', 'საათში 15 €'],
    ['შეთანხმებით', 'შეთანხმებით'],
    ['1000–2000 ₾ + ბონუსი', '1 000–2 000 ₾ + ბონუსი'],
    ['800 ლარი (ხელზე ასაღები)', '800 ₾ (ხელზე ასაღები)'],
  ])
    assert.equal(compactSalary(source), expected);
  assert.equal(
    compactSchedule('ორშაბათი-პარასკევი, კვირაში 40 სამუშაო საათი;'),
    'ორშ–პარ, კვირაში 40 საათი',
  );
  assert.equal(
    compactSchedule('მონაცვლეობით 24 საათი / 48 საათი დასვენება'),
    'მონაცვლეობით 24 საათი / 48 საათი დასვენება',
  );
  assert.equal(
    factAlreadyVisible('ანაზღაურება: 1000 ლარი', 'ანაზღაურება: 1000 ლარი', []),
    true,
  );
  assert.equal(
    factAlreadyVisible('საცდელი ვადა: 3 თვე', 'ანაზღაურება: 1000 ლარი', []),
    false,
  );
});

void test('multi-city regional postings do not collapse to one recognized city', () => {
  for (const value of [
    'გორი, ქარელი, კასპი',
    'ახალციხე, ბორჯომი',
    'ქუთაისი, სამტრედია',
    'თელავი, წინანდალი',
  ])
    assert.equal(
      explicitWorkCity({ description: 'სამუშაო ადგილი: ' + value }),
      '',
    );
  assert.equal(
    explicitWorkCity({ description: 'სამუშაო ადგილი: სამტრედია' }),
    'სამტრედია',
  );
});

void test('salary keeps qualifiers and adds only a known missing rate period', () => {
  assert.equal(compactSalary('2000 ლარი Net', 'თვე'), '2 000 ₾ ხელზე ასაღები · თვეში');
  assert.equal(compactSalary('100 ₾ დღეში', 'დღე'), '100 ₾ დღეში');
  assert.equal(compactSalary('1000 ლარიდან + ბონუსი'), '1000 ლარიდან + ბონუსი');
  assert.equal(compactSalary('1500 ₾', ''), '1 500 ₾');
  assert.equal(compactSalary('1500 ₾', 'unknown'), '1 500 ₾');
  assert.equal(compactSalary(''), '');
});
