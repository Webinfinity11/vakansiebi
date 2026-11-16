import { apiError, checkOrigin, readBody } from '@/lib/server/auth';
import { requireCompanyRole } from '@/lib/server/company-auth';
import { companyNotifications, saveCompanyNotifications } from '@/lib/server/company-notifications';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };
export async function GET() {
  try { return Response.json(await companyNotifications(await requireCompanyRole(['owner', 'recruiter', 'viewer'], true)), { headers }); }
  catch (e) { return apiError(e); }
}
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    return Response.json(await saveCompanyNotifications(await requireCompanyRole(['owner'], true), await readBody(req)), { headers });
  } catch (e) { return apiError(e); }
}
