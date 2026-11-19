import { apiError, checkOrigin, readBody } from '@/lib/server/auth';
import { requireCompanyRole } from '@/lib/server/company-auth';
import { updateCompanyDetails } from '@/lib/server/company-accounts';
export const dynamic = 'force-dynamic';
/* The identification code, contact person and phone a company review needs; they
   can be left out at registration and given here later. */
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    return Response.json(
      await updateCompanyDetails(await requireCompanyRole(['owner']), await readBody(req)),
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return apiError(e);
  }
}
