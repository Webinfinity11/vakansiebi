import { clientKey } from '@/lib/server/rate-limit';
import { z } from 'zod';
import { apiError, checkOrigin, readBody } from '@/lib/server/auth';
import {
  changeCompanyPassword,
  createCompanySession,
  requireCompanyRole,
  setCompanySession,
} from '@/lib/server/company-auth';
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const company = await requireCompanyRole(
      ['owner', 'recruiter', 'viewer'],
      false,
      true,
    );
    const data = z
      .object({
        currentPassword: z.string().max(128).default(''),
        password: z.string().max(128),
      })
      .parse(await readBody(req));
    await changeCompanyPassword(
      company,
      data.currentPassword,
      data.password,
      clientKey(req),
    );
    // Other devices are signed out; this one stays signed in with the new password.
    await setCompanySession(await createCompanySession(company.id));
    return Response.json(
      { ok: true },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (e) {
    return apiError(e);
  }
}
