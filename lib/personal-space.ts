import { z } from 'zod';

export const filtersSchema = z.object({
  query: z.string().max(200),
  city: z.string().max(300),
  category: z.string().max(100),
  subcategory: z.string().max(60).optional(),
  source: z.string().max(100),
  paid: z.boolean(),
  remote: z.boolean(),
  sort: z.string().max(100),
  salaryPeriod: z.enum(['month', 'day']).default('month'),
  salaryFrom: z.number().int().min(0).max(100000000).nullable().default(null),
  salaryTo: z.number().int().min(0).max(100000000).nullable().default(null),
  employment: z
    .enum(['all', 'part-time', 'internship', 'daily'])
    .default('all'),
  entryLevel: z.boolean().default(false),
  /* Whether the words are looked for in descriptions too. Off by default. */
  deep: z.boolean().default(false),
  postedWithin: z
    .union([
      z.literal(0),
      z.literal(1),
      z.literal(3),
      z.literal(7),
      z.literal(30),
    ])
    .default(0),
});
export type SearchFilters = z.infer<typeof filtersSchema>;
