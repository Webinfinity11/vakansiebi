import { z } from 'zod';
import { apiError, checkOrigin, readBody } from '@/lib/server/auth';
import { requireCompanyRole } from '@/lib/server/company-auth';
import { extendJobDeadline } from '@/lib/server/job-deadline';
export const dynamic = 'force-dynamic';
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const company = await requireCompanyRole(['owner', 'recruiter']);
    const { jobId } = z.object({ jobId: z.uuid() }).parse(await readBody(req));
    return Response.json(await extendJobDeadline(company, jobId), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (e) { return apiError(e); }
}
