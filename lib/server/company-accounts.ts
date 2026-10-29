import { z } from 'zod';
import { db, transaction } from './db';
import { ApiError } from './auth';
import { companyKey } from '../company-key';
import { companyUsername } from '../company-portal';
import { safeEmail } from '../application-contact';
import { isGenericCompanyName } from '../company-logo-identity';
import { hashCompanyPassword, newCompanyPassword } from './company-auth';

export async function companyAccounts() {
  return (
    await db().query(
      'SELECT a.id,a.company_key,p.name,a.username,a.email,a.enabled,a.must_change_password,a.version FROM company_accounts a JOIN company_profiles p USING(company_key) ORDER BY a.created_at DESC LIMIT 500',
    )
  ).rows;
}
const createSchema = z.object({
  name: z.string().trim().min(2).max(160),
  username: companyUsername,
  email: z
    .string()
    .trim()
    .max(254)
    .refine((s) => !!safeEmail(s)),
  confirmed: z.literal(true),
});
export async function createCompanyAccount(input: unknown) {
  const data = createSchema.parse(input),
    key = companyKey(data.name);
  if (!key || isGenericCompanyName(data.name))
    throw new ApiError('მიუთითე კომპანიის სრული სახელი.');
  const password = newCompanyPassword(),
    hash = await hashCompanyPassword(password);
  try {
    const account = await transaction(async (c) => {
      await c.query(
        'INSERT INTO company_profiles(company_key,name) VALUES($1,$2) ON CONFLICT DO NOTHING',
        [key, data.name],
      );
      const { rows } = await c.query(
        'INSERT INTO company_accounts(company_key,username,email,password_hash) VALUES($1,$2,$3,$4) RETURNING id,username,company_key',
        [key, data.username, data.email, hash],
      );
      await c.query(
        "INSERT INTO audit_log(action,actor,after_data) VALUES('company.account_created','admin',$1)",
        [{ id: rows[0].id, companyKey: key, username: data.username }],
      );
      return rows[0];
    });
    return { account, password };
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === '23505'
    )
      throw new ApiError(
        'ამ კომპანიას უკვე აქვს ანგარიში ან მომხმარებლის სახელი დაკავებულია.',
        409,
      );
    throw error;
  }
}
export async function changeCompanyAccount(input: unknown) {
  const data = z
    .object({
      id: z.uuid(),
      version: z.number().int().positive(),
      action: z.enum(['reset-password', 'disable', 'enable', 'assign-job']),
      jobId: z.uuid().optional(),
    })
    .parse(input);
  const password =
    data.action === 'reset-password' ? newCompanyPassword() : null;
  const hash = password ? await hashCompanyPassword(password) : null;
  return transaction(async (c) => {
    const account = (
      await c.query('SELECT * FROM company_accounts WHERE id=$1 FOR UPDATE', [
        data.id,
      ])
    ).rows[0];
    if (!account) throw new ApiError('ანგარიში ვერ მოიძებნა.', 404);
    if (account.version !== data.version)
      throw new ApiError('ანგარიში უკვე შეიცვალა. განაახლე სია.', 409);
    if (data.action === 'assign-job') {
      if (!data.jobId) throw new ApiError('მიუთითე ვაკანსიის ID.');
      const job = (
        await c.query('SELECT draft,status FROM jobs WHERE id=$1 FOR UPDATE', [
          data.jobId,
        ])
      ).rows[0];
      if (
        !job ||
        job.status === 'merged' ||
        companyKey(job.draft.company) !== account.company_key
      )
        throw new ApiError(
          'ვაკანსიის კომპანიის სახელი ანგარიშს არ ემთხვევა. შეამოწმე ვაკანსია და კომპანიის მონაცემები.',
          409,
        );
      const existing = (
        await c.query(
          'SELECT company_key FROM company_job_ownership WHERE job_id=$1',
          [data.jobId],
        )
      ).rows[0];
      if (existing && existing.company_key !== account.company_key)
        throw new ApiError('ვაკანსია სხვა ანგარიშს ეკუთვნის.', 409);
      await c.query(
        'INSERT INTO company_job_ownership(job_id,company_key) VALUES($1,$2) ON CONFLICT DO NOTHING',
        [data.jobId, account.company_key],
      );
    } else {
      await c.query(
        `UPDATE company_accounts SET password_hash=coalesce($2,password_hash),must_change_password=CASE WHEN $2 IS NOT NULL THEN true ELSE must_change_password END,enabled=CASE WHEN $3='disable' THEN false WHEN $3='enable' THEN true ELSE enabled END WHERE id=$1`,
        [data.id, hash, data.action],
      );
      await c.query('DELETE FROM company_sessions WHERE account_id=$1', [
        data.id,
      ]);
    }
    await c.query(
      'UPDATE company_accounts SET version=version+1,updated_at=now() WHERE id=$1',
      [data.id],
    );
    await c.query(
      "INSERT INTO audit_log(action,actor,after_data) VALUES($1,'admin',$2)",
      ['company.account_' + data.action, { id: data.id, jobId: data.jobId }],
    );
    return {
      ok: true,
      ...(password ? { password, username: account.username } : {}),
    };
  });
}
