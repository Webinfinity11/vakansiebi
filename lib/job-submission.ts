import { placementTiers } from './placement';
import { z } from 'zod';
import { categories, type Vacancy } from './types';
import { safeEmail } from './application-contact';
import { telephoneNumber } from './vacancy-details';
import { submissionLogoSchema } from './submission-logo';

export const nativeSource = 'JOBX';
export const employmentOptions = [
  'სრული განაკვეთი',
  'ნახევარი განაკვეთი',
  'სტაჟირება',
  'ერთდღიანი სამუშაო',
] as const;
export const workModes = ['ადგილზე', 'ჰიბრიდული', 'დისტანციური'] as const;
export const contactRequiredMessage =
  'მიუთითე ელფოსტა, ტელეფონი ან https:// ბმული';
export function contactDestination(
  value: string,
): { email: string; phone: string; applicationUrl: string } | null {
  const contact = value.trim();
  if (/^https?:\/\//i.test(contact)) {
    try {
      const u = new URL(contact);
      return u.protocol === 'https:' &&
        !u.username &&
        !u.password &&
        u.hostname.includes('.')
        ? { email: '', phone: '', applicationUrl: contact }
        : null;
    } catch {
      return null;
    }
  }
  if (contact.includes('@')) {
    const email = safeEmail(contact);
    return email &&
      !/^(privacy|dpo|noreply|no-reply|abuse|unsubscribe)@/i.test(email)
      ? { email, phone: '', applicationUrl: '' }
      : null;
  }
  return telephoneNumber(contact)
    ? { email: '', phone: contact, applicationUrl: '' }
    : null;
}
export function submissionDate(now = new Date()) {
  return now.toLocaleDateString('en-CA', { timeZone: 'Asia/Tbilisi' });
}
const text = (min: number, max: number) =>
  z
    .string({ error: 'შეავსე ველი' })
    .trim()
    .min(min, `მინიმუმ ${min} სიმბოლო`)
    .max(max, `მაქსიმუმ ${max} სიმბოლო`)
    .refine(
      (v) =>
        !/\p{Cc}/u.test(
          v.replaceAll('\n', '').replaceAll('\r', '').replaceAll('\t', ''),
        ),
      'ამოიღე არასწორი სიმბოლოები',
    );
const amount = z.union([
  z.literal(''),
  z
    .string({ error: 'შეავსე ველი' })
    .regex(/^\d{1,7}$/, 'მიუთითე მთელი რიცხვი')
    .refine(
      (v) => Number(v) > 0 && Number(v) <= 1000000,
      'მიუთითე თანხა 1-დან 1 000 000-მდე',
    ),
]);
export const submissionSchema = z
  .object({
    requestId: z.uuid({ error: 'განაახლე გვერდი და სცადე ხელახლა' }),
    placement: z
      .enum(placementTiers, { error: 'აირჩიე განთავსების ტიპი' })
      .default('standard'),
    title: text(3, 120),
    company: text(2, 160),
    logo: submissionLogoSchema,
    category: z.enum(categories).or(z.literal('')).default(''),
    city: text(0, 100),
    mode: z.enum(workModes, { error: 'აირჩიე მუშაობის ფორმატი' }),
    employmentType: z.enum(employmentOptions, {
      error: 'აირჩიე დასაქმების ტიპი',
    }),
    salaryFrom: amount,
    salaryTo: amount,
    salaryPeriod: z.enum(['თვე', 'დღე'], {
      error: 'აირჩიე ანაზღაურების სიხშირე',
    }),
    salaryBasis: z
      .enum(['ხელზე', 'დარიცხული'], { error: 'აირჩიე ანაზღაურების ტიპი' })
      .default('ხელზე'),
    deadline: z
      .string({ error: 'შეავსე ველი' })
      .refine(
        (v) =>
          /^\d{4}-\d{2}-\d{2}$/.test(v) &&
          Number.isFinite(Date.parse(v)) &&
          new Date(v).toISOString().slice(0, 10) === v,
        'აირჩიე სწორი თარიღი',
      ),
    description: text(30, 20000),
    contact: text(3, 2000),
    consent: z.literal(true, { error: 'დაადასტურე ინფორმაციის გამოქვეყნება' }),
    // Honeypot: filled values are silently accepted, so autofill does not cause a 400.
    fax: z.string().max(200).default(''),
  })
  .superRefine((v, ctx) => {
    if (!contactDestination(v.contact))
      ctx.addIssue({
        code: 'custom',
        path: ['contact'],
        message: contactRequiredMessage,
      });
    if (v.mode !== 'დისტანციური' && v.city.length < 2)
      ctx.addIssue({
        code: 'custom',
        path: ['city'],
        message: 'აირჩიე ქალაქი',
      });
    if (v.salaryTo && !v.salaryFrom)
      ctx.addIssue({
        code: 'custom',
        path: ['salaryFrom'],
        message: 'მიუთითე საწყისი თანხაც',
      });
    if (v.salaryFrom && v.salaryTo && Number(v.salaryTo) < Number(v.salaryFrom))
      ctx.addIssue({
        code: 'custom',
        path: ['salaryTo'],
        message: 'ზედა ზღვარი საწყის თანხაზე ნაკლებია',
      });
    const today = submissionDate();
    const latest = submissionDate(new Date(Date.now() + 90 * 86400000));
    if (v.deadline < today || v.deadline > latest)
      ctx.addIssue({
        code: 'custom',
        path: ['deadline'],
        message: 'აირჩიე ვადა დღევანდელი დღიდან 90 დღის ფარგლებში',
      });
  });
export type JobSubmission = z.infer<typeof submissionSchema>;
export function submissionVacancy(
  data: JobSubmission,
  id: string,
  logoUrl = '',
): Vacancy {
  const dest = contactDestination(data.contact) ?? {
    email: '',
    phone: '',
    applicationUrl: '',
  };
  const salary = data.salaryFrom
    ? `${data.salaryFrom}${data.salaryTo ? `–${data.salaryTo}` : '-დან'} ₾ / ${data.salaryPeriod} · ${data.salaryBasis}`
    : '';
  return {
    title: data.title,
    company: data.company,
    category: data.category,
    city: data.city,
    mode: data.mode,
    employmentType: data.employmentType,
    salary,
    salaryMin: data.salaryFrom ? Number(data.salaryFrom) : null,
    currency: salary ? 'GEL' : '',
    salaryPeriod: salary ? data.salaryPeriod : '',
    description: data.description,
    facts: [
      ...(dest.email ? [{ label: 'ელფოსტა CV-სთვის', value: dest.email }] : []),
      ...(dest.phone ? [{ label: 'ტელეფონი', value: dest.phone }] : []),
    ],
    applicationLinks: dest.applicationUrl
      ? [{ label: 'განაცხადის შევსება', url: dest.applicationUrl }]
      : [],
    source: nativeSource,
    url: `https://jobx.ge/vacancies/${id}`,
    deadline: data.deadline,
    datePosted: submissionDate(),
    logoUrl,
  };
}
