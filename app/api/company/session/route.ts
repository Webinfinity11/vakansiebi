import { z } from 'zod';
import { apiError, checkOrigin, readBody } from '@/lib/server/auth';
import {
  loginCompany,
  setCompanySession,
  logoutCompany,
} from '@/lib/server/company-auth';
import { clientKey } from '@/lib/server/rate-limit';
export const dynamic = 'force-dynamic';
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const data = z
      .object({ username: z.string().max(128), password: z.string().max(128) })
      .parse(await readBody(req));
    const token = await loginCompany(
      data.username,
      data.password,
      clientKey(req),
    );
    await setCompanySession(token);
    return Response.json(
      { ok: true },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (e) {
    return apiError(e);
  }
}
export async function DELETE(req: Request) {
  try {
    checkOrigin(req);
    await logoutCompany();
    return Response.json(
      { ok: true },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (e) {
    return apiError(e);
  }
}
