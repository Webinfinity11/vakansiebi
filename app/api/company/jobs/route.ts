import { ZodError } from 'zod';
import { companyJobIssueFields } from '@/lib/company-job-steps';
import { apiError, checkOrigin, readBody } from '@/lib/server/auth';
import { requireCompanyRole } from '@/lib/server/company-auth';
import { companyJobs, changeCompanyJob } from '@/lib/server/company-jobs';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    return Response.json(await companyJobs(await requireCompanyRole()), {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (e) {
    if (e instanceof ZodError)
      return Response.json(
        {
          error: 'შეამოწმეთ მონიშნული ველები.',
          fields: companyJobIssueFields(e.issues),
        },
        { status: 400 },
      );
    return apiError(e);
  }
}
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    return Response.json(
      await changeCompanyJob(
        await requireCompanyRole(['owner', 'recruiter']),
        await readBody(req),
      ),
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (e) {
    if (e instanceof ZodError)
      return Response.json(
        {
          error: 'შეამოწმეთ მონიშნული ველები.',
          fields: companyJobIssueFields(e.issues),
        },
        { status: 400 },
      );
    return apiError(e);
  }
}
