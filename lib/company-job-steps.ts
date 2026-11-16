import type { ZodIssue } from 'zod';
import type { CompanyJobForm } from './company-job-form';
import { submissionSchema, submissionDate } from './job-submission';
import { jobQuestionsSchema, type JobQuestion } from './job-questions';

export const companyJobSteps = [
  { id: 'position', title: 'ვაკანსია' },
  { id: 'placement', title: 'გადახედვა და გამოქვეყნება' },
] as const;
export type CompanyJobStep = (typeof companyJobSteps)[number]['id'];
export type CompanyJobErrors = Record<string, string>;
export type ValidationOptions = { imported?: boolean; today?: string };
export const fieldSteps: Record<keyof CompanyJobForm, CompanyJobStep> = {
  title: 'position',
  city: 'position',
  category: 'position',
  mode: 'position',
  employmentType: 'position',
  salaryFrom: 'position',
  salaryTo: 'position',
  salaryPeriod: 'position',
  salaryBasis: 'position',
  experience: 'position',
  languages: 'position',
  description: 'position',
  contact: 'position',
  deadline: 'position',
  questions: 'position',
  placement: 'placement',
};
export function companyJobIssueMessage(issue: ZodIssue): string {
  const path = issue.path.filter((p) => p !== 'form');
  const field = String(path[0] ?? 'form');
  const tooLong = issue.code === 'too_big';
  if (field === 'title')
    return tooLong
      ? 'დასახელება მაქსიმუმ 120 სიმბოლოა'
      : 'მიუთითეთ პოზიციის დასახელება';
  if (field === 'city')
    return tooLong
      ? 'ქალაქის დასახელება მაქსიმუმ 100 სიმბოლოა'
      : 'აირჩიეთ ქალაქი';
  if (field === 'description')
    return tooLong
      ? 'აღწერა მაქსიმუმ 20 000 სიმბოლოა'
      : 'აღწერა ძალიან მოკლეა — დაწერეთ მინიმუმ 30 სიმბოლო';
  if (field === 'contact')
    return 'მიუთითეთ ელფოსტა, ტელეფონი ან https:// ბმული';
  if (field === 'deadline') return 'აირჩიეთ ვადა დღეიდან 90 დღის ფარგლებში';
  if (field === 'salaryFrom' || field === 'salaryTo') {
    if (issue.message.includes('საწყისი თანხაც'))
      return 'მიუთითეთ საწყისი თანხაც';
    if (issue.message.includes('ზედა ზღვარი'))
      return 'ზედა ზღვარი საწყის თანხაზე ნაკლებია';
    return 'მიუთითეთ მთელი რიცხვი 1-დან 1 000 000-მდე';
  }
  if (field === 'questions') {
    if (path.includes('options'))
      return 'მიუთითეთ მინიმუმ ორი განსხვავებული პასუხი';
    if (path.includes('preferred'))
      return 'სასურველი პასუხი აირჩიეთ ვარიანტებიდან';
    if (path.includes('text'))
      return tooLong ? 'კითხვა მაქსიმუმ 300 სიმბოლოა' : 'დაწერეთ კითხვა';
    return 'შეამოწმეთ კითხვარი — დასაშვებია მაქსიმუმ 5 კითხვა';
  }
  if (field === 'languages')
    return issue.message === 'ეს ენა უკვე არჩეულია'
      ? issue.message
      : 'აირჩიეთ მაქსიმუმ 5 ენა და ენის ცოდნის დონე';
  const messages: Record<string, string> = {
    experience: 'აირჩიეთ სამუშაო გამოცდილება',
    category: 'აირჩიეთ კატეგორია',
    mode: 'აირჩიეთ მუშაობის ფორმატი',
    employmentType: 'აირჩიეთ დასაქმების ტიპი',
    salaryPeriod: 'აირჩიეთ ანაზღაურების სიხშირე',
    salaryBasis: 'აირჩიეთ ანაზღაურების ტიპი',
    placement: 'აირჩიეთ განთავსების ტიპი',
  };
  return messages[field] ?? 'შეამოწმეთ ველის მნიშვნელობა';
}
export function companyJobIssueFields(
  issues: readonly ZodIssue[],
): CompanyJobErrors {
  const fields: CompanyJobErrors = {};
  for (const issue of issues) {
    const path = issue.path.filter((p) => p !== 'form');
    const field = String(path[0] ?? 'form');
    fields[field] ??= companyJobIssueMessage(issue);
  }
  return fields;
}
export function validateAll(
  form: CompanyJobForm,
  { imported = false, today = submissionDate() }: ValidationOptions = {},
): CompanyJobErrors {
  const result = submissionSchema.safeParse({
    ...form,
    ...(imported
      ? { salaryFrom: '', salaryTo: '', experience: '', languages: [] }
      : {}),
    requestId: '00000000-0000-4000-8000-000000000001',
    company: 'კომპანია',
    notificationEmail: 'hr@example.com',
    logo: '',
    consent: true,
  });
  const issues = result.success
    ? []
    : result.error.issues.filter(
        (i) => !(i.path[0] === 'deadline' && i.message.includes('90')),
      );
  const fields = companyJobIssueFields(issues);
  const latest = new Date(Date.parse(today) + 90 * 86400000)
    .toISOString()
    .slice(0, 10);
  if (form.deadline < today || form.deadline > latest)
    fields.deadline = 'აირჩიეთ ვადა დღეიდან 90 დღის ფარგლებში';
  const questions = jobQuestionsSchema.safeParse(form.questions ?? []);
  if (!questions.success)
    Object.assign(
      fields,
      companyJobIssueFields(
        questions.error.issues.map((i) => ({
          ...i,
          path: ['questions', ...i.path],
        })),
      ),
    );
  return fields;
}
export function validateStep(
  form: CompanyJobForm,
  step: CompanyJobStep,
  options: ValidationOptions = {},
): CompanyJobErrors {
  return Object.fromEntries(
    Object.entries(validateAll(form, options)).filter(
      ([field]) => fieldSteps[field as keyof CompanyJobForm] === step,
    ),
  );
}
export function firstInvalidStep(
  errors: CompanyJobErrors,
): CompanyJobStep | null {
  return (
    companyJobSteps.find((s) =>
      Object.keys(errors).some(
        (f) => fieldSteps[f as keyof CompanyJobForm] === s.id,
      ),
    )?.id ?? null
  );
}
export function qualityHints(form: CompanyJobForm, today = submissionDate()) {
  return [
    { id: 'salary', done: !!form.salaryFrom, text: 'მიუთითეთ ანაზღაურება' },
    {
      id: 'description',
      done:
        form.description.trim().length >= 400 ||
        (/მოვალეობ/.test(form.description) && /მოთხოვნ/.test(form.description)),
      text: 'აღწერეთ მოვალეობები და მოთხოვნები',
    },
    { id: 'category', done: !!form.category, text: 'აირჩიეთ კატეგორია' },
    {
      id: 'deadline',
      done: Date.parse(form.deadline) - Date.parse(today) >= 14 * 86400000,
      text: 'განაცხადების მისაღებად გამოყავით მინიმუმ 14 დღე',
    },
    {
      id: 'experience',
      done: !!form.experience,
      text: 'მიუთითეთ საჭირო გამოცდილება',
    },
  ];
}
export const descriptionSections = [
  'მოვალეობები',
  'მოთხოვნები',
  'პირობები',
] as const;
export const questionPresets: Omit<JobQuestion, 'id'>[] = [
  {
    text: 'გაქვთ მართვის მოწმობა?',
    kind: 'yes_no',
    options: [],
    preferred: '',
  },
  {
    text: 'გაქვთ მსგავს პოზიციაზე მუშაობის გამოცდილება?',
    kind: 'yes_no',
    options: [],
    preferred: '',
  },
  {
    text: 'შეგიძლიათ ცვლებში მუშაობა?',
    kind: 'yes_no',
    options: [],
    preferred: '',
  },
  {
    text: 'შეგიძლიათ შაბათ-კვირას მუშაობა?',
    kind: 'yes_no',
    options: [],
    preferred: '',
  },
  {
    text: 'როდის შეგიძლიათ მუშაობის დაწყება?',
    kind: 'choice',
    options: ['დაუყოვნებლივ', 'ორ კვირაში', 'ერთ თვეში'],
    preferred: '',
  },
];

// Version is stored in the draft JSON, so old rows need no database migration.
export function restoreJobStep(step: number, wizardVersion?: number): number {
  if (wizardVersion === 2) return step === 2 ? 2 : 1;
  return step === 3 || step === 4 ? 2 : 1;
}
export function visibleJobErrors(errors: CompanyJobErrors, touched: readonly string[], submitted: boolean): CompanyJobErrors {
  return Object.fromEntries(Object.entries(errors).filter(([field]) => submitted || touched.includes(field)));
}
