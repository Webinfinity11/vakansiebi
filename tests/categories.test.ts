import test from 'node:test';
import assert from 'node:assert/strict';
import {
  titleCategory,
  sourceCategory,
  classify,
  jobsCategories,
} from '../worker/categories';
import { categories } from '../lib/types';

const titles: Record<(typeof categories)[number], string[]> = {
  ტექნოლოგიები: ['Java Developer', 'პროგრამისტი', 'Frontend Developer', 'Data Analyst'],
  გაყიდვები: ['გაყიდვების მენეჯერი', 'Sales Manager', 'მოლარე', 'გაყიდვების კონსულტანტი'],
  მარკეტინგი: ['SMM სპეციალისტი', 'Marketing Specialist', 'მარკეტინგის მენეჯერი'],
  ადმინისტრაცია: ['ოფის მენეჯერი', 'Office Manager', 'ასისტენტი'],
  ფინანსები: ['ბუღალტერი', 'Accountant', 'ბუღალტერიის მენეჯერი'],
  ლოჯისტიკა: ['მძღოლი', 'Driver', 'კურიერი', 'ლოჯისტიკის მენეჯერი'],
  მომსახურება: ['მიმტანი', 'Waiter', 'ბარისტა'],
  სამედიცინო: ['ექთანი', 'Nurse', 'ექიმი'],
  განათლება: ['მასწავლებელი', 'Teacher'],
  მშენებლობა: ['ინჟინერ-მშენებელი', 'Construction Engineer', 'მშენებელი'],
  დაცვა: ['დაცვის თანამშრომელი', 'Security Guard'],
  წარმოება: ['მკერავი', 'Tailor', 'წარმოების მუშა'],
  იურიდიული: ['იურისტი', 'Lawyer'],
  სილამაზე: ['სტილისტი', 'Hair Stylist'],
  სხვა: ['რაღაც უცნობი', ''],
};

void test('every catalogue category has representative Georgian and English titles', () => {
  assert.equal(categories.length, 15);
  assert.deepEqual(Object.keys(titles).sort(), [...categories].sort());
  const wrong = Object.entries(titles).flatMap(([category, list]) =>
    list
      .map((title) => ({ title, expected: category, actual: titleCategory(title) }))
      .filter((r) => r.actual !== r.expected),
  );
  assert.deepEqual(wrong, []);
});

void test('specific occupations win over the generic manager rule and case does not matter', () => {
  assert.equal(titleCategory('გაყიდვების მენეჯერი'), 'გაყიდვები');
  assert.equal(titleCategory('ოფის მენეჯერი'), 'ადმინისტრაცია');
  assert.equal(titleCategory('JAVA DEVELOPER'), 'ტექნოლოგიები');
  assert.equal(titleCategory('  Senior   Accountant  '), 'ფინანსები');
  assert.equal(titleCategory('Ｊａｖａ Developer'), 'ტექნოლოგიები');
  for (const category of categories) assert.ok(categories.includes(category));
});

void test('jobs.ss.ge spheres map onto the taxonomy and unknown or generic ones say nothing', () => {
  assert.equal(sourceCategory('ss', 68), 'ტექნოლოგიები');
  assert.equal(sourceCategory('ss', 63), 'ფინანსები');
  assert.equal(sourceCategory('ss', 57), 'ლოჯისტიკა');
  assert.equal(sourceCategory('ss', 45), 'დაცვა');
  assert.equal(sourceCategory('ss', '68'), 'ტექნოლოგიები');
  assert.equal(sourceCategory('ss', 52), '');
  assert.equal(sourceCategory('ss', 999999), '');
  for (const empty of [null, undefined, '', NaN, 'abc'])
    assert.equal(sourceCategory('ss', empty), '');
});

void test('jobs.ge category labels or ids map onto the taxonomy; "other" says nothing', () => {
  assert.equal(sourceCategory('jobs', 'IT/პროგრამირება'), 'ტექნოლოგიები');
  assert.equal(sourceCategory('jobs', 'სამართალი'), 'იურიდიული');
  assert.equal(sourceCategory('jobs', 'მედიცინა/ფარმაცია'), 'სამედიცინო');
  assert.equal(sourceCategory('jobs', 'დაცვა/უსაფრთხოება'), 'დაცვა');
  assert.equal(sourceCategory('jobs', ' IT/პროგრამირება '), 'ტექნოლოგიები');
  assert.equal(sourceCategory('jobs', 6), 'ტექნოლოგიები');
  assert.equal(sourceCategory('jobs', '6'), 'ტექნოლოგიები');
  assert.equal(sourceCategory('jobs', 'სხვა'), '');
  assert.equal(sourceCategory('jobs', 9), '');
  assert.equal(sourceCategory('jobs', 'არარსებული'), '');
  for (const empty of [null, undefined, '']) assert.equal(sourceCategory('jobs', empty), '');
});

void test('the jobs.ge category table is complete and only uses catalogue categories', () => {
  assert.equal(jobsCategories.length, 17);
  assert.equal(new Set(jobsCategories.map((c) => c.cid)).size, 17);
  assert.equal(new Set(jobsCategories.map((c) => c.label)).size, 17);
  for (const entry of jobsCategories) {
    assert.ok(categories.includes(entry.category as (typeof categories)[number]), entry.label);
    assert.ok(Number.isInteger(entry.cid) && entry.cid > 0);
    assert.ok(entry.label.trim().length > 0);
  }
  assert.ok(jobsCategories.some((c) => c.label === 'სხვა' && c.category === 'სხვა'));
});

void test('a source category is preferred over the title, and the title is the fallback', () => {
  assert.equal(classify('Java Developer', 'გაყიდვები'), 'გაყიდვები');
  assert.equal(classify('Java Developer', ''), 'ტექნოლოგიები');
  assert.equal(classify('Java Developer'), 'ტექნოლოგიები');
  assert.equal(classify('რაღაც უცნობი', sourceCategory('ss', 52)), 'სხვა');
  assert.equal(classify('ბუღალტერი', sourceCategory('jobs', 'სხვა')), 'ფინანსები');
  assert.equal(classify('დიზაინერი', sourceCategory('ss', 68)), 'ტექნოლოგიები');
});
