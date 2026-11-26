import { createHash, randomBytes } from 'node:crypto';
import { db, transaction } from './db';
import { ApiError } from './auth';
import type { CompanyIdentity } from '../company-portal';
import { cvBaseConsentVersion } from '../cv-base-consent';

export function cvInviteHash(token: string) {
  return /^[A-Za-z0-9_-]{43}$/.test(token) ? createHash('sha256').update(token).digest('hex') : null;
}
export async function inviteCvToBase(company: CompanyIdentity, entry: string) {
  if (!['owner', 'recruiter'].includes(company.role)) throw new ApiError('ამ მოქმედების უფლება არ გაქვთ.', 403);
  if (!/^upload:[0-9a-f-]{36}$/.test(entry)) throw new ApiError('კანდიდატი ვერ მოიძებნა.', 404);
  return transaction(async client => {
    const own = await client.query("SELECT id FROM company_cv_uploads WHERE id=$1 AND company_key=$2 AND source='upload' FOR UPDATE", [entry.slice(7), company.companyKey]);
    if (!own.rowCount) throw new ApiError('კანდიდატი ვერ მოიძებნა.', 404);
    const token = randomBytes(32).toString('base64url');
    const result = await client.query(`INSERT INTO company_cv_invites(company_key,upload_id,token_hash,created_by)
      VALUES($1,$2,$3,$4) ON CONFLICT(upload_id) DO UPDATE SET
      token_hash=EXCLUDED.token_hash,created_by=EXCLUDED.created_by,created_at=now(),expires_at=now()+interval '30 days'
      WHERE company_cv_invites.consented_at IS NULL RETURNING expires_at`,
    [company.companyKey,entry.slice(7),cvInviteHash(token),company.id]);
    if (!result.rowCount) throw new ApiError('ამ მოწვევაზე პასუხი უკვე მიღებულია.', 409);
    return { link: `${(process.env.APP_URL || 'https://jobx.ge').replace(/\/$/,'')}/cv-consent/${token}`, invite: { expiresAt:result.rows[0].expires_at.toISOString(),consentedAt:null,withdrawnAt:null } };
  });
}
export async function cvInvite(token: string) {
  const hash=cvInviteHash(token);
  if (!hash) return null;
  const {rows}=await db().query(`SELECT p.name AS company,u.name,i.consented_at,i.withdrawn_at
    FROM company_cv_invites i JOIN company_profiles p ON p.company_key=i.company_key
    JOIN company_cv_uploads u ON u.id=i.upload_id AND u.company_key=i.company_key
    WHERE i.token_hash=$1 AND (i.expires_at>now() OR i.consented_at IS NOT NULL)`,[hash]);
  return rows[0] ?? null;
}
export async function changeCvConsent(token: string, action: 'consent'|'withdraw') {
  const hash=cvInviteHash(token);
  if (!hash) throw new ApiError('ბმული აღარ მოქმედებს.',404);
  return transaction(async client=>{
    const {rows}=await client.query(`SELECT * FROM company_cv_invites WHERE token_hash=$1
      AND (expires_at>now() OR consented_at IS NOT NULL) FOR UPDATE`,[hash]);
    const row=rows[0];
    if (!row) throw new ApiError('ბმული აღარ მოქმედებს.',404);
    if (action==='consent') {
      // A replay cannot reinstate consent after withdrawal.
      if (!row.consented_at) await client.query('UPDATE company_cv_invites SET consented_at=now(),consent_version=$2 WHERE id=$1',[row.id,cvBaseConsentVersion]);
    } else if (row.consented_at && !row.withdrawn_at) {
      // The trigger deletes all shared references in this same transaction.
      await client.query('UPDATE company_cv_invites SET withdrawn_at=now() WHERE id=$1',[row.id]);
    }
    return {ok:true};
  });
}
