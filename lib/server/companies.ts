import { z } from 'zod';
import { db, transaction } from './db';
import { ApiError } from './auth';
import { companyKey } from '../company-key';
import { safeExternalUrl } from '../vacancy-media';

const external = z
  .string()
  .max(2000)
  .refine((v) => !v || safeExternalUrl(v) === v);
export const companySchema = z.object({
  name: z.string().trim().min(2).max(300),
  logoUrl: external,
  website: external,
  description: z.string().trim().max(3000),
  version: z.number().int().nonnegative(),
});
export async function getCompany(name: string) {
  const row = (
    await db().query('SELECT * FROM company_profiles WHERE company_key=$1', [
      companyKey(name),
    ])
  ).rows[0];
  return row
    ? {
        name: row.name,
        logoUrl: row.logo_url,
        website: row.website,
        description: row.description,
        version: row.version,
      }
    : { name, logoUrl: '', website: '', description: '', version: 0 };
}
export async function saveCompany(input: unknown) {
  const data = companySchema.parse(input),
    key = companyKey(data.name);
  if (!key) throw new ApiError('მიუთითე კომპანიის სახელი');
  return transaction(async (c) => {
    await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      'company:' + key,
    ]);
    const current = (
      await c.query(
        'SELECT * FROM company_profiles WHERE company_key=$1 FOR UPDATE',
        [key],
      )
    ).rows[0];
    if ((current?.version || 0) !== data.version)
      throw new ApiError(
        'კომპანიის მონაცემები შეიცვალა. გახსენი ხელახლა.',
        409,
      );
    await c.query(
      'INSERT INTO company_profiles(company_key,name,logo_url,website,description) VALUES($1,$2,$3,$4,$5) ON CONFLICT(company_key) DO UPDATE SET name=excluded.name,logo_url=excluded.logo_url,website=excluded.website,description=excluded.description,version=company_profiles.version+1,updated_at=now()',
      [key, data.name, data.logoUrl, data.website, data.description],
    );
    await c.query(
      'INSERT INTO audit_log(action,actor,before_data,after_data) VALUES($1,$2,$3,$4)',
      ['company.save', 'admin', current || null, data],
    );
    return { ...data, version: data.version + 1 };
  });
}
