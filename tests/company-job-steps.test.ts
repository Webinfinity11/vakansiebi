import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { newCompanyJob, type CompanyJobForm } from '../lib/company-job-form';
import {
  companyJobSteps, fieldSteps, restoreJobStep, visibleJobErrors,
  validateAll,
  validateStep,
  firstInvalidStep,
  qualityHints,
  descriptionSections,
  questionPresets,
} from '../lib/company-job-steps';
import { submissionSchema, submissionDate } from '../lib/job-submission';
const today = submissionDate();
const form = (): CompanyJobForm => ({
  ...newCompanyJob(),
  title: 'კონსულტანტი',
  description: 'მომხმარებლის დახმარება და პროდუქციის წარდგენა.',
  contact: 'hr@example.com',
  deadline: today,
});
const cases: [string, Partial<CompanyJobForm>, string, string][] = [
  ['title short', { title: 'აბ' }, 'title', 'მიუთითეთ პოზიციის დასახელება'],
  [
    'title long',
    { title: 'ა'.repeat(121) },
    'title',
    'დასახელება მაქსიმუმ 120 სიმბოლოა',
  ],
  ['city missing', { city: '' }, 'city', 'აირჩიეთ ქალაქი'],
  [
    'city long',
    { city: 'ა'.repeat(101) },
    'city',
    'ქალაქის დასახელება მაქსიმუმ 100 სიმბოლოა',
  ],
  [
    'salary fractional',
    { salaryFrom: '1.5' },
    'salaryFrom',
    'მიუთითეთ მთელი რიცხვი 1-დან 1 000 000-მდე',
  ],
  [
    'salary zero',
    { salaryFrom: '0' },
    'salaryFrom',
    'მიუთითეთ მთელი რიცხვი 1-დან 1 000 000-მდე',
  ],
  [
    'salary huge',
    { salaryFrom: '1000001' },
    'salaryFrom',
    'მიუთითეთ მთელი რიცხვი 1-დან 1 000 000-მდე',
  ],
  [
    'salary missing lower',
    { salaryTo: '100' },
    'salaryFrom',
    'მიუთითეთ საწყისი თანხაც',
  ],
  [
    'salary inverted',
    { salaryFrom: '200', salaryTo: '100' },
    'salaryTo',
    'ზედა ზღვარი საწყის თანხაზე ნაკლებია',
  ],
  [
    'description short',
    { description: 'მოკლე' },
    'description',
    'აღწერა ძალიან მოკლეა — დაწერეთ მინიმუმ 30 სიმბოლო',
  ],
  [
    'description long',
    { description: 'ა'.repeat(20001) },
    'description',
    'აღწერა მაქსიმუმ 20 000 სიმბოლოა',
  ],
  [
    'contact invalid',
    { contact: 'http://example.com' },
    'contact',
    'მიუთითეთ ელფოსტა, ტელეფონი ან https:// ბმული',
  ],
  [
    'deadline empty',
    { deadline: '' },
    'deadline',
    'აირჩიეთ ვადა დღეიდან 90 დღის ფარგლებში',
  ],
  [
    'deadline invalid calendar',
    { deadline: '2026-02-30' },
    'deadline',
    'აირჩიეთ ვადა დღეიდან 90 დღის ფარგლებში',
  ],
  [
    'deadline old',
    { deadline: '2000-01-01' },
    'deadline',
    'აირჩიეთ ვადა დღეიდან 90 დღის ფარგლებში',
  ],
  [
    'deadline far',
    { deadline: '2099-01-01' },
    'deadline',
    'აირჩიეთ ვადა დღეიდან 90 დღის ფარგლებში',
  ],
  [
    'language duplicates',
    {
      languages: [
        { name: 'ინგლისური', level: 'B2' },
        { name: 'ინგლისური', level: '' },
      ],
    },
    'languages',
    'ეს ენა უკვე არჩეულია',
  ],
  [
    'question empty',
    {
      questions: [
        {
          id: randomUUID(),
          text: '',
          kind: 'yes_no',
          options: [],
          preferred: '',
        },
      ],
    },
    'questions',
    'დაწერეთ კითხვა',
  ],
  [
    'question long',
    {
      questions: [
        {
          id: randomUUID(),
          text: 'ა'.repeat(301),
          kind: 'yes_no',
          options: [],
          preferred: '',
        },
      ],
    },
    'questions',
    'კითხვა მაქსიმუმ 300 სიმბოლოა',
  ],
  [
    'question options',
    {
      questions: [
        {
          id: randomUUID(),
          text: 'შეგიძლიათ?',
          kind: 'choice',
          options: ['კი', 'კი'],
          preferred: '',
        },
      ],
    },
    'questions',
    'მიუთითეთ მინიმუმ ორი განსხვავებული პასუხი',
  ],
];
for (const [name, patch, field, message] of cases)
  test(name, () =>
    assert.equal(validateAll({ ...form(), ...patch })[field], message),
  );
test('all passing combinations also pass submissionSchema with company fields', () => {
  for (const mode of ['ადგილზე', 'ჰიბრიდული', 'დისტანციური'] as const)
    for (const salary of ['', '1', '1000000'])
      for (const experience of [
        '',
        'გამოცდილების გარეშე',
        '1–3 წელი',
      ] as const) {
        const value = {
          ...form(),
          mode,
          salaryFrom: salary,
          experience,
          languages: [{ name: 'ინგლისური' as const, level: 'B2' as const }],
        };
        assert.deepEqual(validateAll(value), {});
        assert.ok(
          submissionSchema.safeParse({
            ...value,
            requestId: randomUUID(),
            company: 'ტესტ კომპანია',
            notificationEmail: 'hr@example.com',
            logo: '',
            consent: true,
          }).success,
        );
      }
});
test('step mapping, remote city, imported salary, hints and presets', () => {
  assert.deepEqual(
    validateAll({ ...form(), mode: 'დისტანციური', city: '' }),
    {},
  );
  assert.deepEqual(
    validateAll({ ...form(), salaryFrom: 'bad' }, { imported: true }),
    {},
  );
  assert.deepEqual(validateStep({ ...form(), title: '' }, 'placement'), {});
  assert.equal(
    firstInvalidStep(validateAll({ ...form(), title: '', contact: '' })),
    'position',
  );
  assert.equal(firstInvalidStep({}), null);
  assert.equal(
    qualityHints({
      ...form(),
      deadline: submissionDate(new Date(Date.now() + 14 * 86400000)),
    }).find((h) => h.id === 'deadline')?.done,
    true,
  );
  assert.equal(descriptionSections.length, 3);
  assert.equal(questionPresets.length, 5);
});
test('optional enums, control characters and question limits cannot bypass validation', () => {
  for (const patch of [
    { title: 'abc\u0001' },
    { experience: 'bad' },
    { languages: [{ name: 'unknown', level: '' }] },
    { languages: Array(6).fill({ name: 'ინგლისური', level: 'B2' }) },
    { category: 'bad' },
    { mode: 'bad' },
    { employmentType: 'bad' },
    { salaryPeriod: 'bad' },
    { salaryBasis: 'bad' },
    { placement: 'bad' },
    {
      questions: Array.from({ length: 6 }, () => ({
        id: randomUUID(),
        text: 'კითხვა',
        kind: 'yes_no',
        options: [],
        preferred: '',
      })),
    },
  ]) {
    assert.ok(
      Object.keys(validateAll({ ...form(), ...patch } as CompanyJobForm))
        .length,
    );
  }
});

test('server issue mapping keeps nested questions and language failures attached to the form', async () => {
  const { companyJobIssueFields } = await import('../lib/company-job-steps');
  assert.deepEqual(
    companyJobIssueFields([
      {
        code: 'custom',
        path: ['form', 'questions', 0, 'options'],
        message: 'bad',
      },
    ]),
    { questions: 'მიუთითეთ მინიმუმ ორი განსხვავებული პასუხი' },
  );
  assert.deepEqual(
    companyJobIssueFields([
      { code: 'custom', path: ['languages'], message: 'ეს ენა უკვე არჩეულია' },
    ]),
    { languages: 'ეს ენა უკვე არჩეულია' },
  );
});

test('two steps map all fields and migrate old drafts without remapping new step 2', () => {
  assert.equal(companyJobSteps.length, 2);
  assert.deepEqual(new Set(Object.values(fieldSteps)), new Set(['position', 'placement']));
  assert.deepEqual([1, 2, 3, 4].map(n => restoreJobStep(n)), [1, 1, 2, 2]);
  assert.deepEqual([1, 2].map(n => restoreJobStep(n, 2)), [1, 2]);
});
test('errors are hidden until blur or an attempted continuation', () => {
  const errors = {title: 'title error', description: 'description error'};
  assert.deepEqual(visibleJobErrors(errors, [], false), {});
  assert.deepEqual(visibleJobErrors(errors, ['title'], false), {title: 'title error'});
  assert.deepEqual(visibleJobErrors(errors, [], true), errors);
});
