import {
  apiError,
  checkOrigin,
  readBody,
  requireAdmin,
} from '@/lib/server/auth';
import { requireCompanyPortal } from '@/lib/server/company-auth';
import {
  companyAccounts,
  companyAccountJobs,
  companySuggestions,
  createCompanyAccount,
  changeCompanyAccount,
  deleteCompany,
} from '@/lib/server/company-accounts';
import { companySetupLink, sendCompanySetup } from '@/lib/server/company-setup';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  try {
    await requireAdmin();
    requireCompanyPortal();
    const params = new URL(req.url).searchParams;
    const companies = params.get('companies');
    const jobsOf = params.get('jobs');
    return Response.json(
      jobsOf !== null
        ? await companyAccountJobs(jobsOf.slice(0, 200))
        : companies !== null
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
          : data.action === 'setup-link'
            ? { link: await companySetupLink(String(data.id)) }
            : data.action === 'send-setup'
              ? await sendCompanySetup(String(data.id))
          : await changeCompanyAccount(data);
    return Response.json(result, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (e) {
    return apiError(e);
  }
}
