import {
  apiError,
  checkOrigin,
  readBody,
  requireAdmin,
} from '@/lib/server/auth';
import { requireCompanyPortal } from '@/lib/server/company-auth';
import {
  companyAccounts,
  companySuggestions,
  createCompanyAccount,
  changeCompanyAccount,
  deleteCompany,
} from '@/lib/server/company-accounts';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  try {
    await requireAdmin();
    requireCompanyPortal();
    const companies = new URL(req.url).searchParams.get('companies');
    return Response.json(
      companies !== null
        ? await companySuggestions(companies.slice(0, 160))
        : await companyAccounts(),
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
    await requireAdmin();
    checkOrigin(req);
    requireCompanyPortal();
    const data = await readBody(req);
    const result =
      data.action === 'create'
        ? await createCompanyAccount(data)
        : data.action === 'delete-company'
          ? await deleteCompany(data)
          : await changeCompanyAccount(data);
    return Response.json(result, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (e) {
    return apiError(e);
  }
}
