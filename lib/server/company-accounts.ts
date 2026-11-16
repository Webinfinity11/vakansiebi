import { companyTrusted } from './trusted-companies';
import { invoiceContact } from '../billing';
import { randomBytes } from 'node:crypto';
import { registrationSchema, invitationSchema } from '../company-registration';
import { companyPassword, type CompanyIdentity } from '../company-portal';
import { verifiedCompanyInfo } from './verified-company-info';
import {
  requireCompanyPortal,
  recordAttempt,
  digest,
  createCompanySession,
} from './company-auth';
import { z } from 'zod';
import type { PoolClient } from 'pg';
import { db, transaction } from './db';
import { ApiError } from './auth';
import { companyKey } from '../company-key';
import { companyUsername } from '../company-portal';
import { safeEmail } from '../application-contact';
import { isGenericCompanyName } from '../company-logo-identity';
import { hashCompanyPassword, newCompanyPassword } from './company-auth';

export async function companyAccounts() {
  const rows = (
    await db().query(
      'SELECT a.id,a.company_key,p.name,a.username,a.email,a.enabled,a.must_change_password,a.version,p.approval_status,p.trusted_mode AS "trustedMode",p.registration_code,a.representative_name,a.position,a.phone,a.email_verified,a.role FROM company_accounts a JOIN company_profiles p USING(company_key) ORDER BY a.created_at DESC LIMIT 500',
    )
  ).rows;
  const trust = new Map<string, boolean>();
  for (const row of rows) {
    if (!trust.has(row.company_key)) trust.set(row.company_key, await companyTrusted(db(), row.company_key));
  }
  return rows.map(row => ({ ...row, trusted: trust.get(row.company_key) ?? false }));
}
/* The longest run of letters or digits in a name: a cheap ILIKE pre-filter
   before the exact companyKey comparison, which SQL cannot reproduce. */
export function companyNameProbe(name: string) {
  return (name.normalize('NFKC').match(/[\p{L}\p{N}]+/gu) || []).reduce(
    (a, b) => (b.length > a.length ? b : a),
    '',
  );
}
const likeEscape = (s: string) => s.replace(/[\\%_]/g, (m) => '\\' + m);
const jobCompany = `COALESCE(NULLIF(btrim(j.published->>'company'),''),btrim(j.draft->>'company'))`;

/** Employer names already on the site, for linking a new account to one. */
export async function companySuggestions(query: string) {
  const probe = companyNameProbe(query);
  if (probe.length < 2) return [];
  const { rows } = await db().query(
    `SELECT ${jobCompany} AS name, count(*)::int AS jobs
       FROM jobs j
      WHERE j.status IN ('published','pending') AND ${jobCompany} ILIKE $1
      GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 40`,
    ['%' + likeEscape(probe) + '%'],
  );
  const merged = new Map<string, { name: string; jobs: number }>();
  for (const r of rows as { name: string; jobs: number }[]) {
    const key = companyKey(r.name);
    if (!key) continue;
    const hit = merged.get(key);
    if (hit) hit.jobs += r.jobs;
    else merged.set(key, { name: r.name, jobs: r.jobs });
  }
  const keys = [...merged.keys()];
  const taken = new Set(
    (
      await db().query(
        'SELECT DISTINCT company_key FROM company_accounts WHERE company_key=ANY($1::text[])',
        [keys],
      )
    ).rows.map((r) => r.company_key as string),
  );
  return keys
    .map((key) => ({ ...merged.get(key)!, hasAccount: taken.has(key) }))
    .sort((a, b) => b.jobs - a.jobs)
    .slice(0, 12);
}

/* Every live or waiting vacancy carrying the account's company name that no
   other account owns. Returns how many were newly attached. */
async function assignCompanyJobs(c: PoolClient, key: string, name: string) {
  const probe = companyNameProbe(name);
  if (!probe) return 0;
  const { rows } = await c.query(
    `SELECT j.id, ${jobCompany} AS name, o.company_key AS owner
       FROM jobs j LEFT JOIN company_job_ownership o ON o.job_id=j.id
      WHERE j.status IN ('published','pending') AND ${jobCompany} ILIKE $1`,
    ['%' + likeEscape(probe) + '%'],
  );
  const ids = (rows as { id: string; name: string; owner: string | null }[])
    .filter((r) => !r.owner && companyKey(r.name || '') === key)
    .map((r) => r.id);
  if (!ids.length) return 0;
  const result = await c.query(
    'INSERT INTO company_job_ownership(job_id,company_key) SELECT unnest($1::uuid[]),$2 ON CONFLICT DO NOTHING',
    [ids, key],
  );
  return result.rowCount || 0;
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
  attachJobs: z.boolean().optional(),
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
      const attached = data.attachJobs
        ? await assignCompanyJobs(c, key, data.name)
        : 0;
      return { ...rows[0], attached };
    });
    return { account, password, attached: account.attached };
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
      action: z.enum([
        'trusted-mode',
        'reset-password',
        'disable',
        'enable',
        'assign-job',
        'assign-company-jobs',
        'approve',
        'reject',
      ]),
      jobId: z.uuid().optional(),
      mode: z.enum(['auto', 'on', 'off']).optional(),
    })
    .parse(input);
  const password =
    data.action === 'reset-password' ? newCompanyPassword() : null;
  const hash = password ? await hashCompanyPassword(password) : null;
  let attached: number | undefined;
  return transaction(async (c) => {
    const account = (
      await c.query('SELECT * FROM company_accounts WHERE id=$1 FOR UPDATE', [
        data.id,
      ])
    ).rows[0];
    if (!account) throw new ApiError('ანგარიში ვერ მოიძებნა.', 404);
    if (account.version !== data.version)
      throw new ApiError('ანგარიში უკვე შეიცვალა. განაახლე სია.', 409);
    if (data.action === 'trusted-mode') {
      if (!data.mode) throw new ApiError('აირჩიე ავტომატური გამოქვეყნების წესი.');
      await c.query('UPDATE company_profiles SET trusted_mode=$2 WHERE company_key=$1', [account.company_key, data.mode]);
    } else if (data.action === 'approve' || data.action === 'reject') {
      if (account.role !== 'owner')
        throw new ApiError(
          'მხოლოდ კომპანიის მფლობელის დამტკიცებაა შესაძლებელი.',
        );
      if (data.action === 'approve' && !account.email_verified)
        throw new ApiError('ჯერ ელფოსტა უნდა დადასტურდეს.');
      await c.query(
        'UPDATE company_profiles SET approval_status=$2 WHERE company_key=$1',
        [
          account.company_key,
          data.action === 'approve' ? 'approved' : 'rejected',
        ],
      );
    } else if (data.action === 'assign-job') {
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
    } else if (data.action === 'assign-company-jobs') {
      const profile = (
        await c.query(
          'SELECT name FROM company_profiles WHERE company_key=$1',
          [account.company_key],
        )
      ).rows[0];
      attached = await assignCompanyJobs(
        c,
        account.company_key,
        profile?.name || '',
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
      [
        data.action === 'trusted-mode' ? 'company.trusted_mode' : 'company.account_' + data.action,
        data.action === 'trusted-mode'
          ? { id: data.id, companyKey: account.company_key, mode: data.mode }
          : { id: data.id, jobId: data.jobId, attached },
      ],
    );
    return {
      ok: true,
      ...(attached !== undefined ? { attached } : {}),
      ...(password ? { password, username: account.username } : {}),
    };
  });
}

// Tokens are stored as hashes; links are logged only in development without Resend.
export async function sendCompanyLink(
  email: string,
  link: string,
  invitation = false,
) {
  if (!process.env.RESEND_API_KEY) {
    if (process.env.NODE_ENV === 'production')
      throw new ApiError('ელფოსტის გაგზავნა დროებით მიუწვდომელია.', 503);
    console.info('[company development link]', link);
    return;
  }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `JOBX <${invoiceContact.email}>`,
      to: [email],
      subject: invitation ? 'მოწვევა კომპანიის გუნდში' : 'ელფოსტის დადასტურება',
      text: `${invitation ? 'გუნდში შესაერთებლად' : 'ელფოსტის დასადასტურებლად'} გახსენით ბმული: ${link}`,
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok)
    throw new ApiError('ელფოსტა ვერ გაიგზავნა. სცადეთ ხელახლა.', 503);
}
export async function registerCompany(
  input: unknown,
  network: string,
  google?: { sub: string; email: string } | null,
) {
  requireCompanyPortal();
  // With Google the address is already verified and there is no password to choose.
  const data = google
    ? {
        ...registrationSchema
          .omit({ password: true, email: true })
          .parse(input),
        email: google.email,
        password: newCompanyPassword() + newCompanyPassword(),
      }
    : registrationSchema.parse(input);
  await recordAttempt(network, 'registration:' + data.email, 'registration');
  if (
    !google &&
    process.env.NODE_ENV === 'production' &&
    !process.env.RESEND_API_KEY
  )
    throw new ApiError('რეგისტრაცია დროებით მიუწვდომელია.', 503);
  const key = companyKey(data.name);
  if (!key || isGenericCompanyName(data.name))
    throw new ApiError('მიუთითეთ კომპანიის სრული სახელი.');
  const hash = await hashCompanyPassword(data.password);
  const token = randomBytes(32).toString('hex');
  try {
    const account = await transaction(async (c) => {
      // An existing company profile can only be claimed after a separate manual review.
      const existing = await c.query(
        'SELECT 1 FROM company_profiles WHERE company_key=$1',
        [key],
      );
      if (existing.rowCount)
        throw new ApiError(
          'კომპანია უკვე არსებობს. ანგარიშის დასაკავშირებლად დაგვიკავშირდით.',
          409,
        );
      const info = verifiedCompanyInfo([data.name]);
      await c.query(
        "INSERT INTO company_profiles(company_key,name,registration_code,approval_status,description,website) VALUES($1,$2,$3,'pending',$4,$5)",
        [
          key,
          data.name,
          data.code,
          info?.description ?? '',
          info?.website ?? '',
        ],
      );
      const { rows } = await c.query(
        'INSERT INTO company_accounts(company_key,username,email,password_hash,must_change_password,email_verified,representative_name,position,phone,google_sub) VALUES($1,$2,$3,$4,false,$8,$5,$6,$7,$9) RETURNING id',
        [
          key,
          'u' + randomBytes(16).toString('hex'),
          data.email,
          hash,
          data.representativeName,
          data.position,
          data.phone,
          !!google,
          google?.sub ?? null,
        ],
      );
      if (!google)
        await c.query(
          'INSERT INTO company_email_tokens(token_hash,account_id) VALUES($1,$2)',
          [digest(token), rows[0].id],
        );
      return rows[0];
    });
    const link = `${process.env.APP_URL || 'https://jobx.ge'}/api/company/register?token=${token}`;
    let deliveryPending = false;
    if (!google)
      try {
        await sendCompanyLink(data.email, link);
      } catch {
        deliveryPending = true;
      }
    return { token: await createCompanySession(account.id), deliveryPending };
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === '23505'
    )
      throw new ApiError('ამ კოდით ან ელფოსტით ანგარიში უკვე არსებობს.', 409);
    throw error;
  }
}
export async function verifyCompanyEmail(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new ApiError('ბმული არასწორია.');
  await transaction(async (c) => {
    const { rows } = await c.query(
      'DELETE FROM company_email_tokens WHERE token_hash=$1 AND expires_at>now() RETURNING account_id',
      [digest(token)],
    );
    if (!rows[0])
      throw new ApiError('ბმულს ვადა გაუვიდა ან უკვე გამოყენებულია.');
    await c.query(
      'UPDATE company_accounts SET email_verified=true,version=version+1 WHERE id=$1',
      [rows[0].account_id],
    );
  });
}
export async function resendCompanyVerification(
  company: CompanyIdentity,
  network: string,
) {
  await recordAttempt(network, 'verify:' + company.id, 'verification');
  if (company.emailVerified) return;
  const token = randomBytes(32).toString('hex');
  await db().query(
    'INSERT INTO company_email_tokens(token_hash,account_id) VALUES($1,$2)',
    [digest(token), company.id],
  );
  await sendCompanyLink(
    company.email,
    `${process.env.APP_URL || 'https://jobx.ge'}/api/company/register?token=${token}`,
  );
}
export async function companyTeam(company: CompanyIdentity) {
  return {
    members: (
      await db().query(
        'SELECT id,email,representative_name AS name,role,enabled FROM company_accounts WHERE company_key=$1 ORDER BY created_at',
        [company.companyKey],
      )
    ).rows,
    invitations: (
      await db().query(
        // Every send (including a repeated invite) sets a fresh 72-hour expiry.
        "SELECT id,email,role,expires_at,expires_at-interval '72 hours' AS sent_at FROM company_team_invitations WHERE company_key=$1 AND expires_at>now() ORDER BY expires_at DESC,id",
        [company.companyKey],
      )
    ).rows,
  };
}
export async function inviteCompanyMember(
  company: CompanyIdentity,
  input: unknown,
  network: string,
) {
  await recordAttempt(network, 'invite:' + company.id, 'invitation');
  const data = invitationSchema.parse(input),
    token = randomBytes(32).toString('hex');
  await transaction(async (c) => {
    if (
      (
        await c.query('SELECT 1 FROM company_accounts WHERE lower(email)=$1', [
          data.email,
        ])
      ).rowCount
    )
      throw new ApiError('ამ ელფოსტით ანგარიში უკვე არსებობს.', 409);
    await c.query(
      "INSERT INTO company_team_invitations(company_key,email,role,token_hash) VALUES($1,$2,$3,$4) ON CONFLICT(company_key,email) DO UPDATE SET role=excluded.role,token_hash=excluded.token_hash,expires_at=now()+interval '72 hours'",
      [company.companyKey, data.email, data.role, digest(token)],
    );
  });
  await sendCompanyLink(
    data.email,
    `${process.env.APP_URL || 'https://jobx.ge'}/company?invite=${token}`,
    true,
  );
}
export async function acceptCompanyInvitation(input: unknown, network: string) {
  requireCompanyPortal();
  const data = z
    .object({
      token: z.string().regex(/^[a-f0-9]{64}$/),
      name: z.string().trim().min(2).max(120),
      password: companyPassword,
    })
    .parse(input);
  await recordAttempt(
    network,
    'accept-invite:' + digest(data.token),
    'acceptance',
  );
  const hash = await hashCompanyPassword(data.password);
  try {
    const account = await transaction(async (c) => {
      const { rows } = await c.query(
        'DELETE FROM company_team_invitations WHERE token_hash=$1 AND expires_at>now() RETURNING *',
        [digest(data.token)],
      );
      const invite = rows[0];
      if (!invite)
        throw new ApiError('მოწვევას ვადა გაუვიდა ან უკვე გამოყენებულია.');
      if (
        !(
          await c.query(
            "SELECT 1 FROM company_accounts WHERE company_key=$1 AND role='owner' AND enabled",
            [invite.company_key],
          )
        ).rowCount
      )
        throw new ApiError('კომპანიის ანგარიშზე წვდომა შეზღუდულია.', 403);
      return (
        await c.query(
          'INSERT INTO company_accounts(company_key,username,email,password_hash,representative_name,role,must_change_password) VALUES($1,$2,$3,$4,$5,$6,false) RETURNING id',
          [
            invite.company_key,
            'u' + randomBytes(16).toString('hex'),
            invite.email,
            hash,
            data.name,
            invite.role,
          ],
        )
      ).rows[0];
    });
    return createCompanySession(account.id);
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === '23505'
    )
      throw new ApiError('ამ ელფოსტით ანგარიში უკვე არსებობს.', 409);
    throw error;
  }
}
export async function changeCompanyMember(
  company: CompanyIdentity,
  input: unknown,
) {
  const data = z
    .object({
      id: z.uuid(),
      action: z.enum(['remove', 'enable', 'recruiter', 'viewer', 'cancel']),
    })
    .parse(input);
  if (data.action === 'cancel') {
    await db().query(
      'DELETE FROM company_team_invitations WHERE id=$1 AND company_key=$2',
      [data.id, company.companyKey],
    );
    return;
  }
  await transaction(async (c) => {
    const result = await c.query(
      "UPDATE company_accounts SET enabled=CASE WHEN $3='remove' THEN false WHEN $3='enable' THEN true ELSE enabled END,role=CASE WHEN $3 IN ('remove','enable') THEN role ELSE $3 END,version=version+1 WHERE id=$1 AND company_key=$2 AND role<>'owner' RETURNING id",
      [data.id, company.companyKey, data.action],
    );
    if (!result.rowCount) throw new ApiError('გუნდის წევრი ვერ მოიძებნა.', 404);
    await c.query('DELETE FROM company_sessions WHERE account_id=$1', [
      data.id,
    ]);
  });
}
