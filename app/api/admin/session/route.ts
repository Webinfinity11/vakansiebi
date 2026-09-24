import { db, transaction } from '@/lib/server/db';
import {
  ApiError,
  apiError,
  checkOrigin,
  readBody,
  verifyPassword,
  sessionToken,
  setSession,
  clearSession,
} from '@/lib/server/auth';
import { clientKey } from '@/lib/server/rate-limit';
import { clientTag, recordLoginAttempt } from '@/lib/server/login-attempts';
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const data = await readBody(req);
    if (!process.env.ADMIN_PASSWORD_HASH)
      throw new ApiError('ადმინის პაროლი ჯერ არ არის გამართული', 503);
    const client = clientTag(clientKey(req));
    await transaction((c) => recordLoginAttempt(c, client));
    if (typeof data.password !== 'string' || !verifyPassword(data.password))
      throw new ApiError('პაროლი არასწორია', 401);
    await setSession(sessionToken());
    await db().query('DELETE FROM login_attempts WHERE client=$1', [client]);
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
export async function DELETE(req: Request) {
  try {
    checkOrigin(req);
    await clearSession();
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
