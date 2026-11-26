import { ZodError } from 'zod';
import { companyJobIssueFields } from '@/lib/company-job-steps';
import { apiError, checkOrigin, readBody } from '@/lib/server/auth';
import { requireCompanyRole } from '@/lib/server/company-auth';
import { companyJobs, changeCompanyJob } from '@/lib/server/company-jobs';
import { deliverInvoiceEmailsAfterResponse } from '@/lib/server/invoice-email-after';
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
    const result = await changeCompanyJob(
      await requireCompanyRole(['owner', 'recruiter']),
      await readBody(req),
    );
    // A submitted paid placement queues its invoice: send it now, not at the next cron.
    deliverInvoiceEmailsAfterResponse();
    return Response.json(result, {
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
