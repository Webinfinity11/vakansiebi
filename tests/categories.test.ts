import test from 'node:test';
import assert from 'node:assert/strict';
import {
  titleCategory,
  sourceCategory,
  classify,
  explicitRoleCategory,
  jobsCategories,
} from '../worker/categories';
import { categories } from '../lib/types';

const titles: Record<(typeof categories)[number], string[]> = {
  ტექნოლოგიები: [
    'Java Developer',
    'პროგრამისტი',
    'Frontend Developer',
    'Data Analyst',
  ],
  გაყიდვები: [
    'გაყიდვების მენეჯერი',
    'Sales Manager',
    'მოლარე',
    'გაყიდვების კონსულტანტი',
  ],
  მარკეტინგი: [
    'SMM სპეციალისტი',
    'Marketing Specialist',
    'მარკეტინგის მენეჯერი',
  ],
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
      .map((title) => ({
        title,
        expected: category,
        actual: titleCategory(title),
      }))
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
  for (const empty of [null, undefined, ''])
    assert.equal(sourceCategory('jobs', empty), '');
});

void test('the jobs.ge category table is complete and only uses catalogue categories', () => {
  assert.equal(jobsCategories.length, 17);
  assert.equal(new Set(jobsCategories.map((c) => c.cid)).size, 17);
  assert.equal(new Set(jobsCategories.map((c) => c.label)).size, 17);
  for (const entry of jobsCategories) {
    assert.ok(
      categories.includes(entry.category as (typeof categories)[number]),
      entry.label,
    );
    assert.ok(Number.isInteger(entry.cid) && entry.cid > 0);
    assert.ok(entry.label.trim().length > 0);
  }
  assert.ok(
    jobsCategories.some((c) => c.label === 'სხვა' && c.category === 'სხვა'),
  );
});

void test('explicit professions take precedence while ambiguous titles retain the source category', () => {
  assert.equal(classify('Java Developer', 'გაყიდვები'), 'ტექნოლოგიები');
  assert.equal(classify('Java Developer', ''), 'ტექნოლოგიები');
  assert.equal(classify('Java Developer'), 'ტექნოლოგიები');
  assert.equal(classify('რაღაც უცნობი', sourceCategory('ss', 52)), 'სხვა');
  assert.equal(
    classify('ბუღალტერი', sourceCategory('jobs', 'სხვა')),
    'ფინანსები',
  );
  assert.equal(classify('დიზაინერი', sourceCategory('ss', 68)), 'ტექნოლოგიები');
});

void test('profession and employer industry are not confused', () => {
  assert.equal(classify('HR მენეჯერი', 'ლოჯისტიკა'), 'ადმინისტრაცია');
  assert.equal(
    classify('ადამიანური რესურსების სპეციალისტი', 'წარმოება'),
    'ადმინისტრაცია',
  );
  assert.equal(classify('მთავარი ბუღალტერი', 'სამედიცინო'), 'ფინანსები');
  assert.equal(classify('მენეჯერი', 'ლოჯისტიკა'), 'ლოჯისტიკა');
  assert.equal(classify('ოპერატორი', 'ფინანსები'), 'ფინანსები');
  assert.equal(classify('HR / ბუღალტერი', 'ფინანსები'), 'ფინანსები');
});

const addedRoles = [
  {
    category: 'სამედიცინო',
    positive: [
      'ექთნის ასისტენტი',
      'Senior Nurse',
      'ექიმის ასისტენტი',
      'Dentist',
    ],
    negative: [
      'სამედიცინო წარმომადგენელი',
      'Medical Representative',
      'ექიმის ვიზიტორი',
    ],
  },
  {
    category: 'მომსახურება',
    positive: ['კონდიტერი', 'მეხინკლე', 'Pastry Chef', 'Baker'],
    negative: ['მზარეულობის მასწავლებელი', 'კონდიტერ-დიზაინერი'],
  },
  {
    category: 'ლოჯისტიკა',
    positive: ['საწყობის თანამშრომელი', 'Warehouse Manager'],
    negative: ['საწყობის მაღაზიის კონსულტანტი', 'Warehouse Sales Consultant'],
  },
  {
    category: 'ფინანსები',
    positive: [
      'საკრედიტო ოფიცერი',
      'ბიზნეს დაკრედიტების ექსპერტის ასისტენტი',
      'Loan Officer',
      'Credit Officer',
    ],
    negative: ['საკრედიტო პროდუქტების გაყიდვების კონსულტანტი'],
  },
  {
    category: 'მარკეტინგი',
    positive: [
      'სოციალური მედიის მენეჯერი',
      'SMM სპეციალისტი',
      'Social Media Manager',
    ],
    negative: ['სოციალური მედიის ტრენერი'],
  },
  {
    category: 'იურიდიული',
    positive: ['იურისტი', 'ადვოკატის თანაშემწე', 'Senior Lawyer', 'Attorney'],
    negative: ['იურისტი (საკრედიტო ადმინისტრატორი) - რეზერვი'],
  },
] as const;

for (const { category, positive, negative } of addedRoles) {
  void test(`explicit ${category} professions override industries and reject unrelated roles`, () => {
    for (const title of positive) {
      assert.equal(explicitRoleCategory(title), category, title);
      assert.equal(classify(title, 'წარმოება'), category, title);
    }
    for (const title of negative) {
      assert.equal(explicitRoleCategory(title), '', title);
      assert.equal(classify(title, 'გაყიდვები'), 'გაყიდვები', title);
    }
  });
}

void test('medical occupation names do not turn an employer sector into a profession', () => {
  for (const title of [
    'დღის ექთანი',
    'ფარმაცევტი',
    'თერაპევტის ასისტენტი',
    'პედიატრის ასისტენტი',
    'ქირურგი',
    'ანესთეზიოლოგი',
    'რენტგენოლოგი',
    'ფიზიოთერაპევტი',
    'ფიზიოთერაპისტი',
    'Doctor',
    'Physician',
    'Pharmacist',
    'Therapist',
    'Pediatrician',
    'Paediatrician',
    'Surgeon',
    'Anesthesiologist',
    'Anaesthesiologist',
    'Radiologist',
    'Physiotherapist',
  ])
    assert.equal(explicitRoleCategory(title), 'სამედიცინო', title);
  for (const title of [
    'ფარმაცევტული პროდუქტის შესყიდვების მენეჯერი',
    'დამლაგებელი სტომატოლოგიურ კლინიკაში ორი დღე კვირაში',
    'სტომატოლოგიური კლინიკის მენეჯერი',
    'ქირურგიული განყოფილების დამლაგებელი',
    'ოჯახის ექიმების სამსახურის ოპერატორი',
    'ადმინისტრატორი, ექიმი-ორთოპედი, ასისტენტი',
    'მორიგე ექთან-რეგისტრატორი',
    'ფარმაცევტი / სამედიცინო წარმომადგენელი',
    'Doctor / Medical Representative',
  ])
    assert.equal(explicitRoleCategory(title), '', title);
  assert.equal(
    classify('ფარმაცევტული საწყობის ოპერატორი', 'სამედიცინო'),
    'ლოჯისტიკა',
  );
});

void test('kitchen and warehouse roles retain mixed sales and design categories', () => {
  for (const title of ['მზარეული', 'მცხობელი', 'Cook', 'Confectioner'])
    assert.equal(explicitRoleCategory(title), 'მომსახურება', title);
  for (const title of [
    'საწყობის მენეჯერი',
    'საწყობის უფროსი',
    'საწყობის მუშა',
    'საწყობის ოპერატორი',
    'საწყობის მეთვალყურე',
  ])
    assert.equal(explicitRoleCategory(title), 'ლოჯისტიკა', title);
  for (const title of [
    'კონსულტანტი, საწყობის თანამშრომელი, მიმღები ზონის სპეციალისტ',
    'გაყიდვების კონსულტანტი, საწყობის თანამშრომელი',
    'საწყობის თანამშრომელი / შემსყიდველი',
    'მიმტანი, მოლარე, მზარეულის დამხმარე, სომელიე',
    'Pastry Designer',
    'Data Warehouse Engineer',
  ])
    assert.equal(explicitRoleCategory(title), '', title);
});

void test('every explicit role abstains when an education signal appears before or after it', () => {
  const professions = [
    'HR მენეჯერი',
    'ბუღალტერი',
    'Java Developer',
    ...addedRoles.flatMap((r) => r.positive),
  ];
  for (const title of professions) {
    for (const education of [
      'მასწავლებელი',
      'ტრენერი',
      'ინსტრუქტორი',
      'Teacher',
      'Trainer',
      'Instructor',
    ]) {
      for (const combined of [
        `${title} / ${education}`,
        `${education} / ${title}`,
      ]) {
        assert.equal(explicitRoleCategory(combined), '', combined);
        assert.equal(classify(combined, 'განათლება'), 'განათლება', combined);
      }
    }
  }
});

void test('different explicit categories remain ambiguous and same-category roles agree', () => {
  for (const title of [
    'HR / ექთანი',
    'იურისტი / საკრედიტო ოფიცერი',
    'მზარეული / საწყობის მენეჯერი',
    'Nurse / Social Media Manager',
  ]) {
    assert.equal(explicitRoleCategory(title), '', title);
    assert.equal(classify(title, 'ადმინისტრაცია'), 'ადმინისტრაცია', title);
  }
  assert.equal(
    explicitRoleCategory('ბუღალტერი / საკრედიტო ოფიცერი'),
    'ფინანსები',
  );
  assert.equal(explicitRoleCategory('ექიმი / ექთანი'), 'სამედიცინო');
});

void test('new Latin role names use Unicode letter boundaries and normalize case', () => {
  for (const title of [
    'განurse',
    'nurseა',
    'მზარchef',
    'chefა',
    'asmm',
    'smmა',
    'lawyerა',
    'lawyering',
    'warehouseა',
    'credit officerა',
  ])
    assert.equal(explicitRoleCategory(title), '', title);
  assert.equal(explicitRoleCategory('ＳＭＭ სპეციალისტი'), 'მარკეტინგი');
  assert.equal(explicitRoleCategory('ᲔᲥᲗᲐᲜᲘ'), 'სამედიცინო');
  assert.equal(explicitRoleCategory('Chef-de-partie'), 'მომსახურება');
});
