import test from 'node:test';
import assert from 'node:assert/strict';
import { salarySummary, salaryDetails } from '../lib/salary-summary';
import { compactSalary } from '../lib/vacancy-presentation';
import { vacancyCardSalary } from '../lib/vacancy-card-labels';

void test('long salary sentences, bank details and contact text produce only a price', () => {
  for (const [input, expected] of [
    ['1200 ლარი (ირიცხება ბარათზე)', '1 200 ₾'],
    ['900 ლარი (საბანკო ანგარიშზე ჩარიცხვით)', '900 ₾'],
    [
      'სკოლას ესაჭიროება თანამშრომელი ცვლაში 3 დღეში ერთხელ. კვება. 1000 ლარი ანაზღაურება',
      '1 000 ₾',
    ],
    [
      'ანაზღაურება დღეში 100დან 150 ლარამდე. ნომერი: 555000000',
      '100–150 ₾ / დღე',
    ],
    [
      'ანაზღაურება გამომუშავებითაა, დღეში გამოდის დაახლოებით 50-დან 80 ლარამდე',
      '≈ 50–80 ₾ / დღე',
    ],
    ['19 დან 30 წლამდე 🦋 ანაზღაურება 1500$ - 2000$.', '1 500–2 000 $'],
    ['80 ლარი/საათი (დღეში საშუალოდ 3–6 სესია)', '80 ₾ / სთ'],
    ['1,500.50 GEL', '1 500.50 ₾'],
    ['32,20 ლარი / საათი', '32.20 ₾ / სთ'],
    ['1.500 ლარი', '1 500 ₾'],
    ['1000 ლარამდე', '≤ 1 000 ₾'],
  ]) {
    assert.equal(salarySummary(input), expected, input);
    assert.equal(compactSalary(input), expected, 'detail uses the same rule');
    for (const source of [
      'hr.ge',
      'jobs.ge',
      'vacancy.hr.gov.ge',
      'gancxadebebi.ge',
      'JOBX',
    ])
      assert.equal(vacancyCardSalary(input, '', source), expected, source);
  }
});
void test('unknown, contradictory and multiple offers never fall back to prose or invented ranges', () => {
  for (const input of [
    '',
    'კონკურენტული',
    'გამოცდილება 5 წელი',
    'გამომუშავებით',
    'ბონუსი 500 ლარი',
    '1000 ლარი + 200 ლარი ბონუსი',
    'დღეში 50 ლარი, თვეში 1500 ლარი',
    'სტაჟირება 650 ლარი; ბარისტა 900 ლარი',
    '1500–1000 ₾',
    '1000$–1500€',
    '-500 ₾',
    '0 ₾',
    '1000000000 ₾',
  ])
    assert.equal(salarySummary(input), '', input);
  for (const input of [
    'შეთანხმებით',
    'განიხილება ინდივიდუალურად, კვალიფიკაციის მიხედვით',
    'ინდივიდუალურად განიხილება',
    'ხელფასი შეთანხმებით; ბონუსი 1000 ლარი',
  ])
    assert.equal(salarySummary(input), 'შეთანხმებით', input);
});

void test('compact labels are stable while full pay conditions remain available separately', () => {
  for (const label of [
    '1 000+ ₾',
    '≈ 1 200–3 000+ ₾ / თვე',
    '≤ 1 000 ₾',
    '32.20 ₾ / საკონტაქტო სთ',
  ])
    assert.equal(salarySummary(label), label);
  assert.equal(
    salaryDetails('1200 ლარი (ირიცხება ბარათზე)'),
    '1200 ლარი (ირიცხება ბარათზე)',
  );
  assert.equal(salaryDetails('2000 ლარი Net'), '2000 ლარი Net');
  assert.equal(salaryDetails('1500 ₾ / თვე'), '');
  assert.equal(
    salaryDetails('1000 ლარი + 200 ლარი ბონუსი'),
    '1000 ლარი + 200 ლარი ბონუსი',
  );
  assert.equal(salarySummary('1000 + 200 ლარი'), '');
  assert.equal(salarySummary('1000 ლარი + 200'), '');
  assert.equal(salarySummary('50 ლარი / unknown'), '');
});
