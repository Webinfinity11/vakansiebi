import {
  apiError,
  checkOrigin,
  readBody,
  requireAdmin,
} from '@/lib/server/auth';
import { requireCompanyPortal } from '@/lib/server/company-auth';
import {
  companyAccounts,
  createCompanyAccount,
  changeCompanyAccount,
} from '@/lib/server/company-accounts';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    await requireAdmin();
    requireCompanyPortal();
    return Response.json(await companyAccounts(), {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(req: Request) {
  try {
    await requireAdmin();
    checkOrigin(req);
    requireCompanyPortal();
    const data = await readBody(req);
    const result =
      data.action === 'create'
        ? await createCompanyAccount(data)
        : await changeCompanyAccount(data);
    return Response.json(result, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (e) {
    return apiError(e);
  }
}
