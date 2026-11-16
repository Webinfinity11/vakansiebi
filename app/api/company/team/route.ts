import { apiError, checkOrigin, readBody } from '@/lib/server/auth';
import { requireCompanyRole } from '@/lib/server/company-auth';
import {
  companyTeam,
  inviteCompanyMember,
  changeCompanyMember,
} from '@/lib/server/company-accounts';
import { clientKey } from '@/lib/server/rate-limit';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    return Response.json(
      await companyTeam(await requireCompanyRole(['owner'])),
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    await inviteCompanyMember(
      await requireCompanyRole(['owner'], true),
      await readBody(req),
      clientKey(req),
    );
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
export async function PATCH(req: Request) {
  try {
    checkOrigin(req);
    await changeCompanyMember(
      await requireCompanyRole(['owner']),
      await readBody(req),
    );
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
