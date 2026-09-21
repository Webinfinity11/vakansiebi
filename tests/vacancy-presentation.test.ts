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
void test('explicit workplaces accept office phrases, inline labels and Latin city spellings', () => {
  for (const [description, expected] of [
    ['ოფისი მდებარეობს ბათუმში.', 'ბათუმი'],
    ['სამუშაო ოფისი მდებარეობს ქ. ქუთაისში', 'ქუთაისი'],
    ['ოფისის მდებარეობა: რუსთავი', 'რუსთავი'],
    ['Office location: Batumi', 'ბათუმი'],
    ['Location: Tbilisi', 'თბილისი'],
    [
      'Location: Shota Rustaveli Tbilisi International Airport, Tbilisi, Georgia',
      'თბილისი',
    ],
    ['ანაზღაურება: 1500 ლარი + ბონუსი სამუშაო ადგილი: თბილისი', 'თბილისი'],
    ['Location: Saburtalo, Tbilisi\nLocation: Vake, Tbilisi', 'თბილისი'],
    ['კომპანია საქმიანობს ბათუმში. Our clients are in Tbilisi.', ''],
    ['კომპანიის სათავო ოფისი მდებარეობს თბილისში.', ''],
    ['იურიდიული მისამართი: ბათუმი\nსაკონტაქტო მისამართი: Tbilisi', ''],
    ['ოფისი მდებარეობს ბათუმში და თბილისში.', ''],
    ['ოფისი მდებარეობს ბათუმში.\nOffice location: Tbilisi', ''],
    ['სამუშაო ადგილი: თბილისი\nLocation: Batumi', ''],
    ['Location: Rustaveli Avenue', ''],
    ['Office location: NewBatumiTown', ''],
  ])
    assert.equal(explicitWorkCity({ description }), expected, description);
  assert.equal(
    explicitWorkCity({
      description: '',
      facts: [{ label: 'Office location', value: 'Kutaisi' }],
    }),
    'ქუთაისი',
  );
});
void test('salary labels show the shared concise amount while original conditions stay in source text', () => {
  for (const [source, expected] of [
    ['ფიქსირებული ხელფასი (1000 ლარი) + ყოველთვიური ბონუსი', '1 000 ₾'],
    ['2 000 ₾ Net;', '2 000 ₾'],
    ['1000–1500 USD gross', '1 000–1 500 $'],
    ['1000 ლარი - 1500 ლარი', '1 000–1 500 ₾'],
    ['100 ₾ დღეში', '100 ₾ / დღე'],
    ['საათში 15 €', '15 € / სთ'],
    ['შეთანხმებით', 'შეთანხმებით'],
    ['1000–2000 ₾ + ბონუსი', '1 000–2 000+ ₾'],
    ['800 ლარი (ხელზე ასაღები)', '800 ₾'],
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

void test('salary adds only a known missing rate period', () => {
  assert.equal(compactSalary('2000 ლარი Net', 'თვე'), '2 000 ₾ / თვე');
  assert.equal(compactSalary('100 ₾ დღეში', 'დღე'), '100 ₾ / დღე');
  assert.equal(compactSalary('1000 ლარიდან + ბონუსი'), '1 000+ ₾');
  assert.equal(compactSalary('1500 ₾', ''), '1 500 ₾');
  assert.equal(compactSalary('1500 ₾', 'unknown'), '1 500 ₾');
  assert.equal(compactSalary(''), '');
});
