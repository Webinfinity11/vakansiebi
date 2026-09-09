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
