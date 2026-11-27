import { apiError, ApiError, checkOrigin } from '@/lib/server/auth';
import { requireCompanyRole } from '@/lib/server/company-auth';
import { readJobImportFile } from '@/lib/server/job-import-file';
import { clientKey, rateLimit } from '@/lib/server/rate-limit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'private, no-store' };
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    await requireCompanyRole(['owner', 'recruiter']);
    if (
      !rateLimit('company-job-import:' + clientKey(req), {
        limit: 10,
        windowMs: 60000,
      }).allowed
    )
      throw new ApiError('სცადეთ მოგვიანებით.', 429);
    return Response.json(await readJobImportFile(req), { headers });
  } catch (e) {
    const response = apiError(e);
    response.headers.set('Cache-Control', headers['Cache-Control']);
    return response;
  }
}
