import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';
import { cookies } from 'next/headers';
const cookieName = 'ertad_admin';
function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32)
    throw Error('Admin authentication is not configured');
  return s;
}
export function verifyPassword(password: string) {
  const stored = process.env.ADMIN_PASSWORD_HASH;
  if (!stored || password.length > 256) return false;
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const supplied = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return (
    expected.length === supplied.length && timingSafeEqual(expected, supplied)
  );
}
export function sessionToken() {
  const payload = `${Date.now() + 12 * 3600000}.${randomBytes(20).toString('hex')}`;
  return `${payload}.${createHmac('sha256', secret()).update(payload).digest('hex')}`;
}
export function verifySession(value: string | undefined) {
  if (!value) return false;
  try {
    const [expires, nonce, sig, ...rest] = value.split('.');
    if (
      rest.length ||
      !nonce ||
      !sig ||
      !/^([a-f0-9]{64})$/.test(sig) ||
      !/^([a-f0-9]{40})$/.test(nonce) ||
      !/^\d+$/.test(expires) ||
      Number(expires) < Date.now() ||
      Number(expires) > Date.now() + 13 * 3600000
    )
      return false;
    const expected = createHmac('sha256', secret())
      .update(`${expires}.${nonce}`)
      .digest();
    const provided = Buffer.from(sig, 'hex');
    return (
      expected.length === provided.length && timingSafeEqual(expected, provided)
    );
  } catch {
    return false;
  }
}
export async function isAdmin() {
  return verifySession((await cookies()).get(cookieName)?.value);
}
export async function requireAdmin() {
  if (!(await isAdmin())) throw new ApiError('ადმინში შესვლა აუცილებელია', 401);
}
export class ApiError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function checkOrigin(request: Request) {
  const origin = request.headers.get('origin');
  const expected = process.env.APP_URL
    ? new URL(process.env.APP_URL).origin
    : new URL(request.url).origin;
  if (origin !== expected)
    throw new ApiError('მოთხოვნის წყარო დაუშვებელია', 403);
}
export async function setSession(token: string) {
  (await cookies()).set(cookieName, token, {
    httpOnly: true,
    secure:
      process.env.APP_URL?.startsWith('https://') ??
      process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 12 * 3600,
  });
}
export async function clearSession() {
  (await cookies()).delete(cookieName);
}
export function apiError(e: unknown) {
  if (e instanceof ApiError)
    return Response.json({ error: e.message }, { status: e.status });
  if (e instanceof Error && e.name === 'ZodError')
    return Response.json(
      { error: 'შეამოწმე ფორმაში შეყვანილი მონაცემები' },
      { status: 400 },
    );
  console.error(e instanceof Error ? e.message : 'Server error');
  return Response.json(
    { error: 'ოპერაცია ვერ შესრულდა. სცადე ხელახლა.' },
    { status: 500 },
  );
}
export async function readBody(req: Request) {
  if (Number(req.headers.get('content-length')) > 200000)
    throw new ApiError('მონაცემები მეტისმეტად დიდია', 413);
  const body = await req.text();
  if (body.length > 200000)
    throw new ApiError('მონაცემები მეტისმეტად დიდია', 413);
  try {
    return JSON.parse(body);
  } catch {
    throw new ApiError('არასწორი მოთხოვნა');
  }
}
