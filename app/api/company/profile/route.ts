import { safeExternalUrl, isLocalLogoUrl } from '@/lib/vacancy-media';
import { apiError, ApiError, checkOrigin, readBody } from '@/lib/server/auth';
import { requireCompany } from '@/lib/server/company-auth';
import { getCompany, saveCompany } from '@/lib/server/companies';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const company = await requireCompany();
    return Response.json(await getCompany(company.name), {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const company = await requireCompany();
    const data = await readBody(req);
    for (const key of ['website', 'logoUrl']) {
      if (typeof data[key] !== 'string' || !data[key]) continue;
      if (key === 'logoUrl' && isLocalLogoUrl(data[key])) continue;
      const normalized = safeExternalUrl(data[key].trim());
      if (!normalized) throw new ApiError('მიუთითე სწორი https ბმული.');
      data[key] = normalized;
    }
    return Response.json(
      await saveCompany(
        { ...data, name: company.name },
        { accountId: company.id, companyKey: company.companyKey },
      ),
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (e) {
    return apiError(e);
  }
}
