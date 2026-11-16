import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { cookies } from 'next/headers';
import { transaction } from './db';
import { ApiError } from './auth';
import { createCompanySession, requireCompanyPortal } from './company-auth';

/* Google sign-in for company accounts (OpenID Connect, authorization code + PKCE).
   A returning Google user is matched by subject id, then by verified email.
   A new Google user still fills in the company details; only the email and the
   password are replaced by the verified Google identity. */

const flowCookie = 'jobx_google_flow';
export const googleSignupCookie = 'jobx_google_signup';
const issuers = ['https://accounts.google.com', 'accounts.google.com'];

export type GoogleIdentity = { sub: string; email: string; name: string };

export function googleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  const base = process.env.APP_URL || 'https://jobx.ge';
  return {
    clientId,
    clientSecret,
    redirectUri: new URL('/api/company/google/callback', base).toString(),
  };
}
export const googleSignInEnabled = () =>
  process.env.COMPANY_PORTAL_ENABLED === 'true' && googleConfig() !== null;

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32)
    throw new Error('Session protection is not configured');
  return value;
}
const b64 = (value: Buffer | string) =>
  Buffer.from(value).toString('base64url');
export function sealValue(data: object, key = secret()) {
  const body = b64(JSON.stringify(data));
  return `${body}.${createHmac('sha256', key).update(body).digest('base64url')}`;
}
export function openValue<T>(
  value: string | undefined,
  key = secret(),
): T | null {
  const [body, mac] = value?.split('.') ?? [];
  if (!body || !mac) return null;
  const expected = createHmac('sha256', key).update(body).digest();
  const supplied = Buffer.from(mac, 'base64url');
  if (
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  )
    return null;
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    return typeof data?.exp === 'number' && data.exp > Date.now() ? data : null;
  } catch {
    return null;
  }
}
const cookieOptions = (maxAge: number, path: string) => ({
  httpOnly: true,
  secure:
    process.env.NODE_ENV === 'production' ||
    process.env.APP_URL?.startsWith('https://') === true,
  // Lax: the browser must send it back on the top-level redirect from Google.
  sameSite: 'lax' as const,
  path,
  maxAge,
});

export function googleAuthUrl(
  config: { clientId: string; redirectUri: string },
  flow: { state: string; nonce: string; verifier: string },
) {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state: flow.state,
    nonce: flow.nonce,
    code_challenge: b64(createHash('sha256').update(flow.verifier).digest()),
    code_challenge_method: 'S256',
    prompt: 'select_account',
  }).toString();
  return url.toString();
}

export async function startGoogleSignIn() {
  requireCompanyPortal();
  const config = googleConfig();
  if (!config) throw new ApiError('Google-ით შესვლა ჯერ არ არის ჩართული.', 503);
  const flow = {
    state: b64(randomBytes(24)),
    nonce: b64(randomBytes(24)),
    verifier: b64(randomBytes(48)),
    exp: Date.now() + 10 * 60_000,
  };
  (await cookies()).set(
    flowCookie,
    sealValue(flow),
    cookieOptions(600, '/api/company/google'),
  );
  return googleAuthUrl(config, flow);
}

/* The ID token comes straight from Google's token endpoint over TLS, so per
   OpenID Connect Core 3.1.3.7 the TLS connection authenticates it; the claims
   are still checked here. */
export function googleClaims(
  idToken: string,
  expected: { clientId: string; nonce: string },
  now = Date.now(),
): GoogleIdentity {
  const payload = idToken.split('.')[1];
  let claims: Record<string, unknown>;
  try {
    claims = JSON.parse(
      Buffer.from(payload ?? '', 'base64url').toString('utf8'),
    );
  } catch {
    throw new ApiError('Google-ის პასუხი ვერ წავიკითხეთ.', 400);
  }
  const audience = claims.aud;
  const valid =
    issuers.includes(String(claims.iss)) &&
    (audience === expected.clientId ||
      (Array.isArray(audience) && audience.includes(expected.clientId))) &&
    typeof claims.exp === 'number' &&
    claims.exp * 1000 > now &&
    claims.nonce === expected.nonce &&
    typeof claims.sub === 'string' &&
    claims.sub.length > 0;
  if (!valid) throw new ApiError('Google-ის პასუხი ვერ დადასტურდა.', 400);
  const email =
    typeof claims.email === 'string' ? claims.email.trim().toLowerCase() : '';
  if (!email || claims.email_verified !== true)
    throw new ApiError('Google ანგარიშის ელფოსტა დადასტურებული არ არის.', 400);
  const name =
    typeof claims.name === 'string' ? claims.name.trim().slice(0, 120) : '';
  return { sub: claims.sub as string, email, name };
}

async function exchangeCode(code: string, verifier: string) {
  const config = googleConfig();
  if (!config) throw new ApiError('Google-ით შესვლა ჯერ არ არის ჩართული.', 503);
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: 'authorization_code',
      code_verifier: verifier,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const body = (await res.json().catch(() => null)) as {
    id_token?: string;
  } | null;
  if (!res.ok || !body?.id_token)
    throw new ApiError('Google-ით შესვლა ვერ დასრულდა. სცადეთ თავიდან.', 400);
  return { idToken: body.id_token, clientId: config.clientId };
}

/* Returns 'signed-in' when an account exists, otherwise 'register' with the
   verified identity kept in a short-lived signed cookie. */
export async function finishGoogleSignIn(params: URLSearchParams) {
  requireCompanyPortal();
  const store = await cookies();
  const flow = openValue<{ state: string; nonce: string; verifier: string }>(
    store.get(flowCookie)?.value,
  );
  store.delete({ name: flowCookie, path: '/api/company/google' });
  if (params.get('error')) return { result: 'cancelled' as const };
  const code = params.get('code');
  if (!flow || !code || params.get('state') !== flow.state)
    throw new ApiError('შესვლის სესიას ვადა გაუვიდა. სცადეთ თავიდან.', 400);
  const { idToken, clientId } = await exchangeCode(code, flow.verifier);
  const google = googleClaims(idToken, { clientId, nonce: flow.nonce });
  const accountId = await linkGoogleAccount(google);
  if (accountId) {
    return {
      result: 'signed-in' as const,
      token: await createCompanySession(accountId),
    };
  }
  store.set(
    googleSignupCookie,
    sealValue({ ...google, exp: Date.now() + 30 * 60_000 }),
    cookieOptions(1800, '/api/company'),
  );
  return { result: 'register' as const };
}

export async function linkGoogleAccount(google: GoogleIdentity) {
  return transaction(async (c) => {
    const { rows } = await c.query<{
      id: string;
      enabled: boolean;
      google_sub: string | null;
    }>(
      'SELECT id,enabled,google_sub FROM company_accounts WHERE google_sub=$1 OR lower(email)=$2 ORDER BY (google_sub=$1) DESC NULLS LAST LIMIT 1 FOR UPDATE',
      [google.sub, google.email],
    );
    const account = rows[0];
    if (!account) return null;
    if (!account.enabled)
      throw new ApiError('ეს ანგარიში გათიშულია. დაგვიკავშირდით.', 403);
    // An email already tied to another Google identity is not taken over.
    if (account.google_sub && account.google_sub !== google.sub)
      throw new ApiError(
        'ეს ელფოსტა სხვა Google ანგარიშთანაა დაკავშირებული.',
        409,
      );
    if (!account.google_sub) {
      // Google has verified the address, which also confirms the account email.
      await c.query(
        'UPDATE company_accounts SET google_sub=$2,email_verified=true,updated_at=now() WHERE id=$1',
        [account.id, google.sub],
      );
      await c.query('DELETE FROM company_email_tokens WHERE account_id=$1', [
        account.id,
      ]);
      await c.query(
        "INSERT INTO audit_log(action,actor,after_data) VALUES('company.google_linked',$1,$2)",
        ['company:' + account.id, { accountId: account.id }],
      );
    }
    return account.id;
  });
}

export async function pendingGoogleSignup(): Promise<GoogleIdentity | null> {
  const data = openValue<GoogleIdentity>(
    (await cookies()).get(googleSignupCookie)?.value,
  );
  return data ? { sub: data.sub, email: data.email, name: data.name } : null;
}
export async function clearGoogleSignup() {
  (await cookies()).delete({ name: googleSignupCookie, path: '/api/company' });
}
