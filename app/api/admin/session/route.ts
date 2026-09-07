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
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const data = await readBody(req);
    if (!process.env.ADMIN_PASSWORD_HASH)
      throw new ApiError('ადმინის პაროლი ჯერ არ არის გამართული', 503);
    await transaction(async (c) => {
      await c.query('SELECT pg_advisory_xact_lock(917402)');
      await c.query(
        "DELETE FROM login_attempts WHERE created_at<now()-interval '15 minutes'",
      );
      const count = (
        await c.query('SELECT count(*)::int count FROM login_attempts')
      ).rows[0].count;
      if (count >= 8)
        throw new ApiError('მრავალი მცდელობა. სცადე 15 წუთში.', 429);
      await c.query('INSERT INTO login_attempts DEFAULT VALUES');
    });
    if (typeof data.password !== 'string' || !verifyPassword(data.password))
      throw new ApiError('პაროლი არასწორია', 401);
    await setSession(sessionToken());
    await db().query('DELETE FROM login_attempts');
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
