import { isCompanyCover } from './company-covers';
import { z } from 'zod';
import { db, transaction } from './db';
import { ApiError } from './auth';
import { companyKey } from '../company-key';
import { isLocalLogoUrl, safeExternalUrl } from '../vacancy-media';

const external = z
  .string()
  .max(2000)
  .refine((v) => !v || safeExternalUrl(v) === v);
export const companySchema = z.object({
  name: z.string().trim().min(2).max(300),
  logoUrl: z
    .string()
    .max(2000)
    .refine((v) => !v || isLocalLogoUrl(v) || safeExternalUrl(v) === v),
  website: external,
  description: z.string().trim().max(3000),
  coverUrl: z
    .string()
    .max(2000)
    .refine((v) => !v || isCompanyCover(v))
    .optional(),
  benefits: z
    .array(z.string().trim().max(120))
    .max(12)
    .transform((values) => [...new Set(values.filter(Boolean))])
    .optional(),
  whyUs: z.string().trim().max(1500).optional(),
  cvBoxEnabled: z.boolean().optional(),
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
        coverUrl: row.cover_url,
        benefits: row.benefits,
        whyUs: row.why_us,
        cvBoxEnabled: row.cv_box_enabled,
        version: row.version,
      }
    : {
        name,
        logoUrl: '',
        website: '',
        description: '',
        coverUrl: '',
        benefits: [],
        whyUs: '',
        cvBoxEnabled: false,
        version: 0,
      };
}
export async function saveCompany(
  input: unknown,
  owner?: { accountId: string; companyKey: string },
) {
  const data = companySchema.parse(input),
    key = companyKey(data.name);
  if (!key) throw new ApiError('მიუთითე კომპანიის სახელი');
  if (owner && key !== owner.companyKey)
    throw new ApiError('კომპანიის შეცვლა დაუშვებელია.', 403);
  return transaction(async (c) => {
    if (
      owner &&
      !(
        await c.query(
          'SELECT 1 FROM company_accounts WHERE id=$1 AND company_key=$2 AND enabled AND NOT must_change_password FOR SHARE',
          [owner.accountId, owner.companyKey],
        )
      ).rowCount
    )
      throw new ApiError('კომპანიის ანგარიშზე წვდომა შეზღუდულია.', 403);
    await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      'company:' + key,
    ]);
    if (
      isLocalLogoUrl(data.logoUrl) &&
      !(
        await c.query(
          'SELECT 1 FROM submission_logos WHERE hash=$1 AND approved_at IS NOT NULL',
          [data.logoUrl.slice('/api/logos/'.length)],
        )
      ).rowCount
    )
      throw new ApiError(
        'ატვირთული ლოგო ჯერ განცხადების გამოქვეყნებისას დაადასტურე.',
      );
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
    if (
      data.coverUrl &&
      !(
        await c.query(
          'SELECT 1 FROM company_cover_images WHERE hash=$1 AND company_key=$2',
          [data.coverUrl.split('/').pop(), key],
        )
      ).rowCount
    )
      throw new ApiError('ქავერის სურათი ვერ მოიძებნა.');
    await c.query(
      'INSERT INTO company_profiles(company_key,name,logo_url,website,description) VALUES($1,$2,$3,$4,$5) ON CONFLICT(company_key) DO UPDATE SET name=excluded.name,logo_url=excluded.logo_url,website=excluded.website,description=excluded.description,version=company_profiles.version+1,updated_at=now()',
      [key, data.name, data.logoUrl, data.website, data.description],
    );
    await c.query(
      `UPDATE company_profiles SET cover_url=$2,benefits=$3,why_us=$4,cv_box_enabled=$5 WHERE company_key=$1`,
      [
        key,
        data.coverUrl ?? current?.cover_url ?? '',
        JSON.stringify(data.benefits ?? current?.benefits ?? []),
        data.whyUs ?? current?.why_us ?? '',
        data.cvBoxEnabled ?? current?.cv_box_enabled ?? false,
      ],
    );
    await c.query(
      'INSERT INTO audit_log(action,actor,before_data,after_data) VALUES($1,$2,$3,$4)',
      [
        'company.save',
        owner ? 'company:' + owner.accountId : 'admin',
        current || null,
        data,
      ],
    );
    return { ...data, version: data.version + 1 };
  });
}
