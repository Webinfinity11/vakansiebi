import {
  createHash,
  createHmac,
  randomBytes,
  scrypt,
  timingSafeEqual,
} from 'node:crypto';
import { cookies } from 'next/headers';
import { db, transaction } from './db';
import { ApiError } from './auth';
import { clientNetwork } from './login-attempts';
import {
  companyPassword,
  companyUsername,
  type CompanyIdentity,
} from '../company-portal';

export const companyCookie = 'jobx_company_session';
export function requireCompanyPortal() {
  if (process.env.COMPANY_PORTAL_ENABLED !== 'true')
    throw new ApiError('კომპანიის სივრცე ჯერ არ არის ჩართული.', 503);
}
const digest = (token: string) =>
  createHash('sha256').update(token).digest('hex');
const derive = (password: string, salt: string) =>
  new Promise<Buffer>((resolve, reject) =>
    scrypt(
      password,
      salt,
      64,
      { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 },
      (error, key) => (error ? reject(error) : resolve(key)),
    ),
  );
export async function hashCompanyPassword(password: string) {
  const salt = randomBytes(24).toString('hex');
  return `scrypt1:${salt}:${(await derive(password, salt)).toString('hex')}`;
}
export async function verifyCompanyPassword(password: string, stored: string) {
  if (password.length > 128) return false;
  const [kind, salt, hash] = stored.split(':');
  const valid =
    kind === 'scrypt1' &&
    /^[a-f0-9]{48}$/.test(salt ?? '') &&
    /^[a-f0-9]{128}$/.test(hash ?? '');
  const supplied = await derive(password, valid ? salt : '0'.repeat(48));
  return !!valid && timingSafeEqual(supplied, Buffer.from(hash, 'hex'));
}
export function newCompanyPassword() {
  return randomBytes(18).toString('base64url');
}
async function recordAttempt(network: string, username: string) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32)
    throw new Error('Session protection is not configured');
  const keyed = (s: string) =>
    createHmac('sha256', secret).update(s).digest('hex');
  const net = keyed('company-network:' + clientNetwork(network)),
    user = keyed('company-user:' + username);
  await transaction(async (c) => {
    await c.query('SELECT pg_advisory_xact_lock(917467)');
    await c.query(
      "DELETE FROM company_login_attempts WHERE created_at<now()-interval '15 minutes'",
    );
    const { rows } = await c.query<{
      network: number;
      username: number;
      total: number;
    }>(
      'SELECT count(*) FILTER(WHERE network_hash=$1)::int network,count(*) FILTER(WHERE username_hash=$2)::int username,count(*)::int total FROM company_login_attempts',
      [net, user],
    );
    if (rows[0].network >= 8 || rows[0].username >= 12 || rows[0].total >= 300)
      throw new ApiError('ძალიან ბევრი მცდელობაა. სცადე 15 წუთში.', 429);
    await c.query(
      'INSERT INTO company_login_attempts(network_hash,username_hash) VALUES($1,$2)',
      [net, user],
    );
  });
  return { net, user };
}
export async function loginCompany(
  usernameInput: string,
  password: string,
  network: string,
) {
  requireCompanyPortal();
  const username = companyUsername.safeParse(usernameInput);
  const attempts = await recordAttempt(
    network,
    username.success ? username.data : usernameInput.slice(0, 64).toLowerCase(),
  );
  const account = username.success
    ? (
        await db().query(
          'SELECT id,password_hash,enabled FROM company_accounts WHERE username=$1',
          [username.data],
        )
      ).rows[0]
    : null;
  const valid = await verifyCompanyPassword(
    password,
    account?.password_hash ?? 'invalid',
  );
  if (!account?.enabled || !valid)
    throw new ApiError('მომხმარებლის სახელი ან პაროლი არასწორია.', 401);
  const token = randomBytes(32).toString('hex');
  await transaction(async (c) => {
    const current = (
      await c.query(
        'SELECT enabled,password_hash FROM company_accounts WHERE id=$1 FOR UPDATE',
        [account.id],
      )
    ).rows[0];
    if (!current?.enabled || current.password_hash !== account.password_hash)
      throw new ApiError('მომხმარებლის სახელი ან პაროლი არასწორია.', 401);
    await c.query('DELETE FROM company_sessions WHERE expires_at<now()');
    await c.query(
      "INSERT INTO company_sessions(token_hash,account_id,expires_at) VALUES($1,$2,now()+interval '12 hours')",
      [digest(token), account.id],
    );
    await c.query(
      'DELETE FROM company_login_attempts WHERE network_hash=$1 AND username_hash=$2',
      [attempts.net, attempts.user],
    );
  });
  return token;
}
export async function companyIdentity(
  token: string | undefined,
): Promise<CompanyIdentity | null> {
  if (
    process.env.COMPANY_PORTAL_ENABLED !== 'true' ||
    !token ||
    !/^[a-f0-9]{64}$/.test(token)
  )
    return null;
  const { rows } = await db().query(
    `UPDATE company_sessions s SET last_seen_at=now() FROM company_accounts a JOIN company_profiles p ON p.company_key=a.company_key
    WHERE s.token_hash=$1 AND s.account_id=a.id AND a.enabled AND s.expires_at>now() AND s.last_seen_at>now()-interval '2 hours'
    RETURNING a.id,a.company_key AS "companyKey",p.name,a.username,a.email,a.must_change_password AS "mustChangePassword"`,
    [digest(token)],
  );
  return rows[0] ?? null;
}
export async function currentCompany() {
  return companyIdentity((await cookies()).get(companyCookie)?.value);
}
export async function requireCompany(allowPasswordChange = false) {
  requireCompanyPortal();
  const company = await currentCompany();
  if (!company)
    throw new ApiError('კომპანიის სივრცეში შესვლა აუცილებელია.', 401);
  if (company.mustChangePassword && !allowPasswordChange)
    throw new ApiError('პირველ შესვლაზე შეცვალე დროებითი პაროლი.', 403);
  return company;
}
export async function setCompanySession(token: string) {
  (await cookies()).set(companyCookie, token, {
    httpOnly: true,
    secure:
      process.env.NODE_ENV === 'production' ||
      process.env.APP_URL?.startsWith('https://') === true,
    sameSite: 'strict',
    path: '/',
    maxAge: 12 * 3600,
  });
}
export async function revokeCompanySession(token: string | undefined) {
  if (token && /^[a-f0-9]{64}$/.test(token))
    await db().query('DELETE FROM company_sessions WHERE token_hash=$1', [
      digest(token),
    ]);
}
export async function logoutCompany() {
  const store = await cookies();
  await revokeCompanySession(store.get(companyCookie)?.value);
  store.delete(companyCookie);
}
export async function changeCompanyPassword(
  company: CompanyIdentity,
  currentPassword: string,
  nextPassword: string,
  network?: string,
) {
  if (network) await recordAttempt(network, 'password:' + company.username);
  companyPassword.parse(nextPassword);
  if (currentPassword === nextPassword)
    throw new ApiError('ახალი პაროლი ძველისგან უნდა განსხვავდებოდეს.');
  const hash = await hashCompanyPassword(nextPassword);
  await transaction(async (c) => {
    const row = (
      await c.query(
        'SELECT password_hash,enabled FROM company_accounts WHERE id=$1 FOR UPDATE',
        [company.id],
      )
    ).rows[0];
    if (
      !row?.enabled ||
      !(await verifyCompanyPassword(currentPassword, row.password_hash))
    )
      throw new ApiError('მიმდინარე პაროლი არასწორია.', 401);
    await c.query(
      'UPDATE company_accounts SET password_hash=$2,must_change_password=false,version=version+1,updated_at=now() WHERE id=$1',
      [company.id, hash],
    );
    await c.query('DELETE FROM company_sessions WHERE account_id=$1', [
      company.id,
    ]);
    await c.query(
      "INSERT INTO audit_log(action,actor,after_data) VALUES('company.password_changed',$1,$2)",
      ['company:' + company.id, { accountId: company.id }],
    );
  });
}
