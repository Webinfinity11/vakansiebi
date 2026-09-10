import { z } from 'zod';
import { safeLogoUrl } from './vacancy-media';
export const vacancySchema = z
  .object({
    logoUrl: z
      .string()
      .max(2000)
      .optional()
      .default('')
      .refine((v) => !v || safeLogoUrl(v) === v, 'ლოგოს მისამართი დაუშვებელია'),
    employmentType: z.string().max(150).optional().default(''),
    facts: z
      .array(
        z.object({ label: z.string().max(200), value: z.string().max(1500) }),
      )
      .max(30)
      .optional()
      .default([]),
    applicationLinks: z
      .array(
        z.object({
          label: z.string().max(150),
          url: z
            .url()
            .refine(
              (v) =>
                new URL(v).protocol === 'https:' &&
                !new URL(v).username &&
                !new URL(v).password,
            ),
        }),
      )
      .max(12)
      .optional()
      .default([]),
    warnings: z.array(z.string().max(500)).max(10).optional().default([]),
    title: z.string().trim().min(2).max(300),
    company: z.string().trim().max(300),
    city: z.string().max(300),
    category: z.string().max(100),
    salary: z.string().max(300),
    salaryMin: z.number().nonnegative().max(100000000).nullable(),
    currency: z.string().max(20),
    salaryPeriod: z.string().max(30),
    mode: z.string().max(100),
    description: z.string().trim().max(100000),
    url: z.url().refine((v) => new URL(v).protocol === 'https:'),
    source: z.string().max(100),
    deadline: z.string().refine(validDate),
    datePosted: z.string().refine(validDate),
  })
  .refine(
    (v) =>
      v.description.length >= 40 ||
      Boolean(
        v.source === 'jobs.ss.ge' &&
        v.company.trim() &&
        /^https:\/\/jobs\.ss\.ge\/ka\/details\/[^/?#]+-\d+\/?(?:[?#].*)?$/.test(
          v.url,
        ),
      ),
    { path: ['description'], message: 'Description is missing or incomplete' },
  );
function validDate(s: string) {
  return (
    s === '' ||
    (/^\d{4}-\d{2}-\d{2}$/.test(s) &&
      Number.isFinite(Date.parse(s)) &&
      new Date(s).toISOString().slice(0, 10) === s)
  );
}
