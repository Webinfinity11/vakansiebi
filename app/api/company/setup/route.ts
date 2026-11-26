import { z } from 'zod';
import { apiError, checkOrigin, readBody } from '@/lib/server/auth';
import { clientKey } from '@/lib/server/rate-limit';
import { requireCompanyPortal, setCompanySession } from '@/lib/server/company-auth';
import { completeCompanySetup, readCompanySetup } from '@/lib/server/company-setup';

const headers = { 'Cache-Control': 'private, no-store' };
/* The one-time "create your password" link the admin sends a new company. */
export async function GET(req: Request) {
  try {
    requireCompanyPortal();
    const token = new URL(req.url).searchParams.get('token') ?? '';
    return Response.json(await readCompanySetup(token.slice(0, 300)), { headers });
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    requireCompanyPortal();
    const data = z.object({ token: z.string().max(300), password: z.string().max(128) }).parse(await readBody(req));
    await setCompanySession(await completeCompanySetup(data.token, data.password, clientKey(req)));
    return Response.json({ ok: true }, { headers });
  } catch (e) {
    return apiError(e);
  }
}
