import { apiError, checkOrigin, readBody } from '@/lib/server/auth';
import { acceptCompanyInvitation } from '@/lib/server/company-accounts';
import { setCompanySession } from '@/lib/server/company-auth';
import { clientKey } from '@/lib/server/rate-limit';
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    await setCompanySession(
      await acceptCompanyInvitation(await readBody(req), clientKey(req)),
    );
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
