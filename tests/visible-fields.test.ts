import test from 'node:test';
import assert from 'node:assert/strict';
import { visibleFields } from '../worker/visible-fields';
import { parseDetail } from '../worker/adapters';

void test('location comes from the job label, never employer history or privacy contacts', () => {
  const result = visibleFields(
    'ჩვენი ოფისებია თბილისი და გორი\nადგილმდებარეობა: ბაკურიანი\nკონტაქტი: ბათუმი',
  );
  assert.equal(result.location, 'ბაკურიანი');
  assert.equal(
    visibleFields('კომპანია დაარსდა თბილისში 1998 წელს.').location,
    '',
  );
  assert.equal(
    visibleFields(
      '"კრედო ბანკი" აცხადებს ვაკანსიას პოზიციაზე - რჩეულის ოპერატორი თბილისში.',
    ).location,
    'თბილისი',
  );
  assert.equal(
    visibleFields(
      'კომპანია აცხადებს ვაკანსიას მენეჯერის პოზიციაზე.\n\nკომპანიის მთავარი ოფისი თბილისში.',
    ).location,
    '',
  );
});
void test('HR keeps an explicitly written salary even when the structured salary field is absent, without inventing a period', () => {
  const state = {
    a: {
      b: {
        data: {
          announcement: {
            announcementId: 123,
            title: 'დრაივის თანამშრომელი',
            customerName: 'Company',
            showSalary: false,
          },
        },
      },
    },
  };
  const html = `<script id="ng-state">${JSON.stringify(state)}</script><div class="application__phone">ტელეფონი: +995 577 22 61 88</div><div class="description"><p>კომპანია აცხადებს ვაკანსიას დრაივის თანამშრომლის პოზიციაზე.</p><p>ხელფასი: 110 ლარი</p></div>`;
  const job = parseDetail(
    'hr',
    html,
    'https://www.hr.ge/announcement/123/test',
  );
  assert.equal(job.salary, '110 ლარი');
  assert.equal(job.salaryPeriod, '');
  assert.ok(
    job.facts?.some(
      (f) => f.label === 'საკონტაქტო ტელეფონი' && f.value === '+995577226188',
    ),
  );
});
void test('salary preserves currency, explicit period, bonus and tax qualification', () => {
  const r = visibleFields(
    'ანაზღაურება: 1 500–2 000 ლარი თვეში + ბონუსი (ხელზე)',
  );
  assert.equal(r.salaryMin, 1500);
  assert.equal(r.currency, 'GEL');
  assert.equal(r.salaryPeriod, 'თვე');
  assert.ok(r.salary.includes('ხელზე'));
  assert.equal(visibleFields('ხელფასი: 2000 USD').salaryPeriod, '');
  assert.equal(visibleFields('ანაზღაურება: ფიქსირებული 4000 ლარი + ბონუსი').salaryMin, 4000);
  assert.equal(visibleFields('ანაზღაურება: ფიქსირებული 4000 ლარი + ბონუსი').salaryPeriod, '');
  assert.equal(visibleFields('ხელფასი: 2000 ლარამდე').salaryMin, null);
  assert.equal(visibleFields('ხელფასი: 2000–1000 ლარი').salary, '');
  assert.equal(visibleFields('გამოცდილება: 2000 საათი').salaryMin, null);
  assert.equal(visibleFields('სამუშაო ფორმატი: Remote').mode, 'დისტანციური');
});
void test('Jobs logo requires matching employer label and HR reversed ranges are withheld', () => {
  const html =
    '<table><tr><td class="dtitle"><b>Designer</b></td><td class="dtitle"><b>Studio</b></td><td class="dtitle"><b>01 სექტემბერი</b><b>30 სექტემბერი</b></td></tr><tr><td><p>Join our experienced design team and create excellent products.</p></td></tr></table><img src="/data/clients/wrong.jpg" title="Other"><img src="/data/clients/studio.jpg" title="Studio">';
  assert.equal(
    parseDetail('jobs', html, 'https://jobs.ge/ge/?view=jobs&id=42').logoUrl,
    'https://jobs.ge/data/clients/studio.jpg',
  );
  const announcement = {
    announcementId: 123,
    title: 'Designer',
    customerName: 'Studio',
    showSalary: true,
    salaryFrom: 3000,
    salaryTo: 1000,
  };
  const hr = `<script id="ng-state">${JSON.stringify({ a: { b: { data: { announcement } } } })}</script><div class="description">Join our experienced design team and create excellent products.</div>`;
  assert.equal(
    parseDetail('hr', hr, 'https://www.hr.ge/announcement/123/test').salary,
    '',
  );
});
void test('daily wages retain an explicit daily period without converting to monthly salary', () => {
  for (const text of [
    'დღიური ანაზღაურება: 100 ლარი',
    'დღიური ხელფასი 80–120 ლარი',
    'ანაზღაურება დღეში: 100 GEL',
    'ხელფასი: დღეში 100 ლარი',
    'ანაზღაურება: 100 ლარი დღიურად',
    'Daily wage: 50 USD',
  ]) {
    const r = visibleFields(text);
    assert.equal(r.salaryPeriod, 'დღე');
    assert.ok(r.salaryMin && r.salaryMin <= 100);
    assert.ok(!r.salary.includes('თვე'));
  }
  assert.equal(
    visibleFields('გადახდა ყოველდღიურად\nხელფასი: 1500 ლარი').salaryPeriod,
    '',
  );
  assert.equal(
    visibleFields('ხელფასი: 1500 ლარი თვეში, თანხა გაიცემა ყოველდღიურად')
      .salaryPeriod,
    'თვე',
  );
});

void test('a contradictory daily label and monthly amount is held for review', () => {
  const r = visibleFields('დღიური ანაზღაურება: 1500 ლარი თვეში');
  assert.equal(r.salary, '');
  assert.equal(r.salaryMin, null);
  assert.equal(r.salaryPeriod, '');
  assert.ok(r.warning);
});
