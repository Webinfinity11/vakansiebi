import { z } from 'zod';
export const PERSONAL_PREFIX = 'ertad-personal:v1:';
export const applicationStatuses = {
  planned: 'გასაგზავნი',
  applied: 'გავაგზავნე',
  interview: 'გასაუბრება',
  closed: 'დასრულებული',
} as const;
export const filtersSchema = z.object({
  query: z.string().max(200),
  city: z.string().max(300),
  category: z.string().max(100),
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
const base = {
  version: z.literal(1),
  id: z.uuid(),
  updatedAt: z.iso.datetime(),
};
export const searchSchema = z.object({
  ...base,
  kind: z.literal('search'),
  name: z.string().trim().min(1).max(80),
  filters: filtersSchema,
});
const https = z.url().refine((v) => {
  const u = new URL(v);
  return u.protocol === 'https:' && !u.username && !u.password;
});
export const applicationSchema = z.object({
  ...base,
  kind: z.literal('application'),
  status: z.enum(['planned', 'applied', 'interview', 'closed']),
  title: z.string().min(2).max(300),
  company: z.string().max(300),
  city: z.string().max(300),
  url: https,
  deadline: z.string().max(10),
});
export const recordSchema = z.discriminatedUnion('kind', [
  searchSchema,
  applicationSchema,
]);
export type PersonalRecord = z.infer<typeof recordSchema>;
export type SavedSearch = z.infer<typeof searchSchema>;
export type Application = z.infer<typeof applicationSchema>;
export type PersonalStorage = Pick<
  Storage,
  'length' | 'key' | 'getItem' | 'setItem' | 'removeItem'
>;
export const recordKey = (r: PersonalRecord) =>
  PERSONAL_PREFIX + r.kind + ':' + r.id;
export function readPersonal(storage: PersonalStorage) {
  const records: PersonalRecord[] = [];
  let invalid = 0;
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key?.startsWith(PERSONAL_PREFIX)) continue;
    try {
      const r = recordSchema.parse(JSON.parse(storage.getItem(key)!));
      if (recordKey(r) !== key) throw Error('Key mismatch');
      records.push(r);
    } catch {
      invalid++;
    }
  }
  return {
    records: records.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    invalid,
  };
}
export function filterIdentity(filters: SearchFilters) {
  const f = filtersSchema.parse(filters);
  return JSON.stringify({
    ...f,
    query: f.query.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase(),
  });
}
export function putPersonal(storage: PersonalStorage, input: PersonalRecord) {
  const record = recordSchema.parse(input);
  const key = recordKey(record);
  if (!storage.getItem(key)) {
    const count = readPersonal(storage).records.filter(
      (r) => r.kind === record.kind,
    ).length;
    if (count >= (record.kind === 'search' ? 20 : 200))
      throw Error(
        record.kind === 'search'
          ? 'შეგიძლია შეინახო მაქსიმუმ 20 ძიება.'
          : 'შეგიძლია შეინახო მაქსიმუმ 200 განაცხადი.',
      );
  }
  storage.setItem(key, JSON.stringify(record));
  return record;
}
export function saveSearch(
  storage: PersonalStorage,
  name: string,
  filters: SearchFilters,
) {
  const existing = readPersonal(storage).records.find(
    (r): r is SavedSearch =>
      r.kind === 'search' &&
      filterIdentity(r.filters) === filterIdentity(filters),
  );
  return putPersonal(storage, {
    version: 1,
    kind: 'search',
    id: existing?.id || crypto.randomUUID(),
    name,
    filters,
    updatedAt: new Date().toISOString(),
  });
}
