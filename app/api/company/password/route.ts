import { clientKey } from '@/lib/server/rate-limit';
import { z } from 'zod';
import { apiError, checkOrigin, readBody } from '@/lib/server/auth';
import {
  changeCompanyPassword,
  logoutCompany,
  requireCompany,
} from '@/lib/server/company-auth';
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const company = await requireCompany(true);
    const data = z
      .object({
        currentPassword: z.string().max(128),
        password: z.string().max(128),
      })
      .parse(await readBody(req));
    await changeCompanyPassword(
      company,
      data.currentPassword,
      data.password,
      clientKey(req),
    );
    await logoutCompany();
    return Response.json(
      { ok: true },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (e) {
    return apiError(e);
  }
}
