import test from 'node:test';
import assert from 'node:assert/strict';
import { newCompanyJob, newCompanyJobDefaults, suggestJobCategory, shortCompanyDescription } from '../lib/company-job-form';
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
test('last vacancy supplies only contact, city, mode and category; blank contact uses account', () => {
  const lastJob = { ...newCompanyJob(), title: 'ძველი', contact: 'last@example.com', city: '', mode: 'დისტანციური' as const, category: 'ტექნოლოგიები' as const, salaryFrom: '1000', placement: 'vip' as const };
  const form = newCompanyJobDefaults({ lastJob, accountEmail: 'demo@example.com', today });
  assert.equal(form.city, ''); assert.equal(form.mode, lastJob.mode); assert.equal(form.category, lastJob.category);
  assert.ok(categories.includes(form.category as typeof categories[number]));
  assert.equal(form.contact, lastJob.contact); assert.equal(form.title, ''); assert.equal(form.salaryFrom, ''); assert.equal(form.placement, 'standard');
  assert.equal(newCompanyJobDefaults({lastJob: {...lastJob, contact: '  '}, accountEmail: 'demo@example.com', today}).contact, 'demo@example.com');
  assert.equal(lastJob.title, 'ძველი');
});
test('category suggestions are narrow, valid and unknown titles stay empty', () => {
  assert.equal(suggestJobCategory('Senior developer'), 'ტექნოლოგიები');
  assert.equal(suggestJobCategory('ბუღალტერი'), 'ფინანსები');
  assert.equal(suggestJobCategory('მენეჯერი'), '');
  assert.equal(suggestJobCategory(''), '');
});
test('company description truncates at a word boundary without changing short text', () => {
  assert.equal(shortCompanyDescription(' მოკლე აღწერა '), 'მოკლე აღწერა');
  assert.equal(shortCompanyDescription('ერთი ორი სამი ოთხი', 10), 'ერთი ორი…');
  assert.equal(shortCompanyDescription('ა'.repeat(201)).length, 201);
});
