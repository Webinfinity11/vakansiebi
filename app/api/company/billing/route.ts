import { z } from 'zod';
import { apiError, checkOrigin, readBody } from '@/lib/server/auth';
import { requireCompanyRole } from '@/lib/server/company-auth';
import {
  companyBilling,
  upgradeCompanyJob,
} from '@/lib/server/company-billing';
import { deliverInvoiceEmailsAfterResponse } from '@/lib/server/invoice-email-after';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    return Response.json(
      await companyBilling(await requireCompanyRole(['owner'])),
      {
        headers: { 'Cache-Control': 'private, no-store' },
      },
    );
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const company = await requireCompanyRole(['owner'], true);
    const data = z
      .object({
        id: z.uuid(),
        version: z.number().int().positive(),
        placement: z.enum(['vip', 'premium']),
      })
      .parse(await readBody(req));
    const result = await upgradeCompanyJob(company, data.id, data.version, data.placement);
    deliverInvoiceEmailsAfterResponse();
    return Response.json(
      result,
      {
        headers: { 'Cache-Control': 'private, no-store' },
      },
    );
  } catch (e) {
    return apiError(e);
  }
}
