import { createHmac, timingSafeEqual } from 'node:crypto';
import { db, transaction } from './db';
import { ApiError } from './auth';
import { companyPassword } from '../company-portal';
import { invoiceContact } from '../billing';
import {
  createCompanySession,
  hashCompanyPassword,
  recordAttempt,
  digest,
} from './company-auth';

/* A one-time "create your password" link the admin sends instead of a temporary
   password. Nothing is stored: the link is signed together with the account's current
   password hash, so it stops working the moment a password is set. */
const validDays = 7;
const expired = 'ბმულს ვადა გაუვიდა ან უკვე გამოყენებულია. ახალი ბმული სთხოვეთ JOBX-ს.';

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error('Session protection is not configured');
  return value;
}
const sign = (id: string, expires: number, passwordHash: string) =>
  createHmac('sha256', secret()).update(`company-setup:${id}:${expires}:${passwordHash}`).digest('hex');

export function companySetupToken(id: string, passwordHash: string, now = Date.now()) {
  const expires = now + validDays * 86400000;
  return Buffer.from(`${id}.${expires}.${sign(id, expires, passwordHash)}`).toString('base64url');
}

/** Splits a token; signature is checked against the account's current hash later. */
export function parseSetupToken(token: string, now = Date.now()) {
  if (!/^[A-Za-z0-9_-]{40,300}$/.test(token)) return null;
  const [id, expiresText, signature] = Buffer.from(token, 'base64url').toString().split('.');
  const expires = Number(expiresText);
  if (!/^[0-9a-f-]{36}$/.test(id ?? '') || !Number.isFinite(expires) || expires < now || !/^[a-f0-9]{64}$/.test(signature ?? ''))
    return null;
  return { id, expires, signature };
}
function signed(parsed: { id: string; expires: number; signature: string }, passwordHash: string) {
  return timingSafeEqual(Buffer.from(sign(parsed.id, parsed.expires, passwordHash)), Buffer.from(parsed.signature));
}

export async function companySetupLink(accountId: string) {
  const row = (await db().query('SELECT password_hash,enabled FROM company_accounts WHERE id=$1', [accountId])).rows[0];
  if (!row) throw new ApiError('ანგარიში ვერ მოიძებნა.', 404);
  if (!row.enabled) throw new ApiError('ანგარიში გათიშულია. ჯერ ჩართეთ.');
  return `${process.env.APP_URL || 'https://jobx.ge'}/company?setup=${companySetupToken(accountId, row.password_hash)}`;
}

/** What the setup screen shows: whose account the link opens. */
export async function readCompanySetup(token: string) {
  const parsed = parseSetupToken(token);
  const row = parsed && (await db().query(
    `SELECT a.password_hash,a.email,p.name FROM company_accounts a JOIN company_profiles p USING(company_key)
     WHERE a.id=$1 AND a.enabled`, [parsed.id])).rows[0];
  if (!parsed || !row || !signed(parsed, row.password_hash)) throw new ApiError(expired, 410);
  return { name: row.name as string, email: row.email as string };
}

/** Sets the password from the link and signs the company in on this device. */
export async function completeCompanySetup(token: string, password: string, network: string) {
  await recordAttempt(network, 'setup:' + digest(token), 'setup');
  companyPassword.parse(password);
  const parsed = parseSetupToken(token);
  if (!parsed) throw new ApiError(expired, 410);
  const hash = await hashCompanyPassword(password);
  await transaction(async (c) => {
    const row = (await c.query('SELECT password_hash,enabled FROM company_accounts WHERE id=$1 FOR UPDATE', [parsed.id])).rows[0];
    if (!row?.enabled || !signed(parsed, row.password_hash)) throw new ApiError(expired, 410);
    await c.query(
      'UPDATE company_accounts SET password_hash=$2,must_change_password=false,password_changed_at=now(),version=version+1,updated_at=now() WHERE id=$1',
      [parsed.id, hash],
    );
    await c.query('DELETE FROM company_sessions WHERE account_id=$1', [parsed.id]);
    await c.query(
      "INSERT INTO audit_log(action,actor,after_data) VALUES('company.password_set_by_link',$1,$2)",
      ['company:' + parsed.id, { accountId: parsed.id }],
    );
  });
  return createCompanySession(parsed.id);
}

/** Emails the link to the account's address; in development the link is only logged. */
export async function sendCompanySetup(accountId: string) {
  const link = await companySetupLink(accountId);
  const row = (await db().query(
    'SELECT a.email,p.name FROM company_accounts a JOIN company_profiles p USING(company_key) WHERE a.id=$1', [accountId])).rows[0];
  if (!process.env.RESEND_API_KEY) {
    if (process.env.NODE_ENV === 'production') throw new ApiError('ელფოსტის გაგზავნა დროებით მიუწვდომელია.', 503);
    console.info('[company setup link]', link);
    return { email: row.email as string };
  }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `JOBX <${invoiceContact.email}>`,
      to: [row.email],
      subject: `${row.name} — კომპანიის სივრცე JOBX-ზე`,
      text: `გამარჯობა!\n\nJOBX-ზე „${row.name}“-ისთვის კომპანიის სივრცე მომზადდა. აქ შეგიძლიათ ვაკანსიების განთავსება და კანდიდატების მართვა.\n\nპაროლის შესაქმნელად და შესასვლელად გახსენით ბმული (მოქმედებს ${validDays} დღე):\n${link}\n\nპატივისცემით,\nJOBX`,
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new ApiError('ელფოსტა ვერ გაიგზავნა. დააკოპირეთ ბმული და გაუგზავნეთ სხვა გზით.', 503);
  return { email: row.email as string };
}
