import { apiError } from '@/lib/server/auth';
import { requireCompanyRole } from '@/lib/server/company-auth';
import { companyAnalytics } from '@/lib/server/company-analytics';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    return Response.json(await companyAnalytics(await requireCompanyRole()), {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (e) {
    return apiError(e);
  }
}
