import test from 'node:test';
import assert from 'node:assert/strict';
import {
  vacancyCardTitle,
  vacancyCardSalary,
} from '../lib/vacancy-card-labels';
const source = 'vacancy.hr.gov.ge';
void test('government card labels retain the actual teaching subject and contact-hour unit', () => {
  const title =
    'პროფესიული საგანმანათლებლო პროგრამის "ელექტროობა" პროფესიული განათლების მასწავლებელი';
  assert.equal(vacancyCardTitle(title, source), 'მასწავლებელი — ელექტროობა');
  assert.equal(vacancyCardTitle(title, 'jobs.ge'), 'მასწავლებელი — ელექტროობა');
  assert.equal(
    vacancyCardSalary(
      'შრომის ანაზღაურება: საათობრივი დატვირთვის მიხედვით, 1 საკონტაქტო სთ - 32.20 ლ',
      '',
      source,
    ),
    '32.20 ₾ / საკონტაქტო სთ',
  );
  assert.equal(vacancyCardSalary('1760 ₾', '', source), '1 760 ₾');
  assert.equal(
    vacancyCardSalary('1000 ₾ + ბონუსი', '', source),
    '1 000 ₾ + ბონუსი',
  );
});
void test('archive role is concise without inventing seniority', () => {
  const title =
    'საისტორიო ცენტრალური არქივის ეროვნული საარქივო ფონდის დოკუმენტების გამოყენების და სამეცნიერო საცნობარო აპარატის განყოფილების სპეციალისტი';
  assert.equal(
    vacancyCardTitle(title, source),
    'სპეციალისტი — საარქივო დოკუმენტების გამოყენება',
  );
  assert.equal(
    vacancyCardTitle('მთავარი ბუღალტერი', source),
    'მთავარი ბუღალტერი',
  );
});

void test('all sources have bounded labels without silently discarding complex pay conditions', () => {
  for (const source of [
    'jobs.ge',
    'hr.ge',
    'vacancy.hr.gov.ge',
    'worknet.moh.gov.ge',
  ]) {
    const title = 'საოპერაციო მიმართულების '.repeat(12) + 'უფროსი სპეციალისტი';
    const label = vacancyCardTitle(title, source);
    assert.ok(Array.from(label).length <= 95);
    assert.ok(label.startsWith('უფროსი სპეციალისტი —'));
    assert.ok(label.endsWith('…'));
    assert.ok(
      Array.from(vacancyCardTitle('📈'.repeat(130), source)).length <= 95,
    );
    assert.equal(
      vacancyCardSalary(
        '1000 ₾ ხელზე, ბონუსი მხოლოდ გეგმის შესრულებისას; ' +
          'დამატებითი პირობები '.repeat(8),
        '',
        source,
      ),
      'ანაზღაურება — იხ. დეტალები',
    );
  }
});

void test('individually negotiated pay has one clear label while numeric offers stay intact', () => {
  assert.equal(
    vacancyCardSalary(
      'განიხილება ინდივიდუალურად, კანდიდატის კვალიფიკაციიდან და გამოცდილებიდან გამომდინარე',
      '',
      'jobs.ge',
    ),
    'შეთანხმებით',
  );
  assert.equal(vacancyCardSalary('შეთანხმებით', '', 'hr.ge'), 'შეთანხმებით');
  assert.equal(
    vacancyCardSalary('1000 ₾ + ბონუსი', '', 'hr.ge'),
    '1 000 ₾ + ბონუსი',
  );
});
