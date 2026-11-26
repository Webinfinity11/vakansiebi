import test from 'node:test';
import assert from 'node:assert/strict';
import { newCompanyJob, newCompanyJobDefaults, suggestJobCategory, shortCompanyDescription, prepareCompanyJob } from '../lib/company-job-form';
import { categories } from '../lib/types';
import { workModes, employmentOptions } from '../lib/job-submission';
import { validateAll } from '../lib/company-job-steps';
const today = '2026-11-16';
test('new vacancy gets account contact, full time and a deterministic 30-day deadline', () => {
  const form = newCompanyJobDefaults({ accountEmail: 'demo@example.com', today });
  assert.equal(form.contact, 'demo@example.com');
  assert.equal(form.deadline, '2026-12-16');
  assert.equal(form.placement, 'standard');
  assert.ok(workModes.includes(form.mode));
  assert.ok(employmentOptions.includes(form.employmentType));
  assert.deepEqual(validateAll({ ...form, title: 'პროგრამისტი', city: 'ბათუმი', description: 'ვაკანსიის აღწერა, მოვალეობები და სამუშაოს მოთხოვნები.' }, { today }), {});
});
test('last vacancy supplies contact, city and mode; category follows the new title', () => {
  const lastJob = { ...newCompanyJob(), title: 'ძველი', contact: 'last@example.com', city: '', mode: 'დისტანციური' as const, category: 'ტექნოლოგიები' as const, salaryFrom: '1000', placement: 'vip' as const };
  const form = newCompanyJobDefaults({ lastJob, accountEmail: 'demo@example.com', today });
  assert.equal(form.city, ''); assert.equal(form.mode, lastJob.mode); assert.equal(form.category, '');
  assert.equal(form.contact, lastJob.contact); assert.equal(form.title, ''); assert.equal(form.salaryFrom, ''); assert.equal(form.placement, 'standard');
  assert.equal(newCompanyJobDefaults({lastJob: {...lastJob, contact: '  '}, accountEmail: 'demo@example.com', today}).contact, 'demo@example.com');
  assert.equal(lastJob.title, 'ძველი');
});
test('category uses the catalogue classifier and falls back to other', () => {
  assert.equal(suggestJobCategory('Senior developer'), 'ტექნოლოგიები');
  assert.equal(suggestJobCategory('ბუღალტერი'), 'ფინანსები');
  assert.equal(suggestJobCategory('მენეჯერი'), 'ადმინისტრაცია');
  assert.equal(suggestJobCategory(''), 'სხვა');
});
test('company description truncates at a word boundary without changing short text', () => {
  assert.equal(shortCompanyDescription(' მოკლე აღწერა '), 'მოკლე აღწერა');
  assert.equal(shortCompanyDescription('ერთი ორი სამი ოთხი', 10), 'ერთი ორი…');
  assert.equal(shortCompanyDescription('ა'.repeat(201)).length, 201);
});

test('automatic values preserve every hidden edit field, including daily salary and paid tier', () => {
  const stored = { ...newCompanyJob(), title: 'ბუღალტერი', category: 'სხვა' as const, experience: '1–3 წელი' as const, languages: [{ name: 'ინგლისური' as const, level: 'B2' as const }], questions: [{ id: 'question', text: 'გაქვთ გამოცდილება?', kind: 'yes_no' as const, options: [], preferred: 'კი' }], contact: 'old@example.com', deadline: '2020-01-01', salaryPeriod: 'დღე' as const, salaryBasis: 'დარიცხული' as const, placement: 'premium' as const, employmentType: 'სტაჟირება' as const };
  assert.deepEqual(prepareCompanyJob(stored, { editing: true, today }), stored);
  const reopened = prepareCompanyJob(stored, { editing: true, reopening: true, today });
  assert.deepEqual(reopened, { ...stored, deadline: '2026-12-16' });
});
test('old paid drafts and copies become standard, expired deadlines renew and category never stays empty', () => {
  for (const deadline of ['', '2020-01-01']) {
    const form = prepareCompanyJob({ ...newCompanyJob(), title: 'ბუღალტერი', placement: 'vip', deadline }, { today });
    assert.equal(form.category, 'ფინანსები');
    assert.equal(form.placement, 'standard');
    assert.equal(form.deadline, '2026-12-16');
  }
  assert.equal(prepareCompanyJob({ ...newCompanyJob(), title: 'უცნობი პოზიცია' }, { today }).category, 'სხვა');
  assert.equal(prepareCompanyJob({ ...newCompanyJob(), deadline: '2026-12-01' }, { today }).deadline, '2026-12-01');
});
test('category inference covers the catalogue', () => {
  const examples = ['პროგრამისტი', 'ბუღალტერი', 'გამყიდველი', 'მარკეტინგის მენეჯერი', 'ოფისის მენეჯერი', 'მიმტანი', 'მძღოლი', 'მშენებელი', 'მასწავლებელი', 'ექიმი', 'იურისტი', 'მკერავი', 'დაცვის თანამშრომელი', 'სტილისტი', 'უცნობი პოზიცია'];
  assert.deepEqual(new Set(examples.map(suggestJobCategory)), new Set(categories));
});
