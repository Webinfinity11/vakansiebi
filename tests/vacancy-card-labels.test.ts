import test from 'node:test';
import assert from 'node:assert/strict';
import { vacancyCardTitle, vacancyCardSalary } from '../lib/vacancy-card-labels';
const source = 'vacancy.hr.gov.ge';
void test('government card labels retain the actual teaching subject and contact-hour unit', () => {
  const title = 'პროფესიული საგანმანათლებლო პროგრამის "ელექტროობა" პროფესიული განათლების მასწავლებელი';
  assert.equal(vacancyCardTitle(title, source), 'მასწავლებელი — ელექტროობა');
  assert.equal(vacancyCardTitle(title, 'jobs.ge'), title);
  assert.equal(vacancyCardSalary('შრომის ანაზღაურება: საათობრივი დატვირთვის მიხედვით, 1 საკონტაქტო სთ - 32.20 ლ', '', source), '32.20 ₾ / საკონტაქტო სთ');
  assert.equal(vacancyCardSalary('1760 ₾', '', source), '1 760 ₾');
  assert.equal(vacancyCardSalary('1000 ₾ + ბონუსი', '', source), '1 000 ₾ + ბონუსი');
});
void test('archive role is concise without inventing seniority', () => {
  const title = 'საისტორიო ცენტრალური არქივის ეროვნული საარქივო ფონდის დოკუმენტების გამოყენების და სამეცნიერო საცნობარო აპარატის განყოფილების სპეციალისტი';
  assert.equal(vacancyCardTitle(title, source), 'სპეციალისტი — საარქივო დოკუმენტების გამოყენება');
  assert.equal(vacancyCardTitle('მთავარი ბუღალტერი', source), 'მთავარი ბუღალტერი');
});
