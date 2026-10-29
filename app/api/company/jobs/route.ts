import { apiError, checkOrigin, readBody } from '@/lib/server/auth';
import { requireCompany } from '@/lib/server/company-auth';
import { companyJobs, changeCompanyJob } from '@/lib/server/company-jobs';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    return Response.json(await companyJobs(await requireCompany()), {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    return Response.json(
      await changeCompanyJob(await requireCompany(), await readBody(req)),
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (e) {
    return apiError(e);
  }
}
