import { revalidateTag } from 'next/cache';
import { safeExternalUrl, isLocalLogoUrl } from '@/lib/vacancy-media';
import { apiError, ApiError, checkOrigin, readBody } from '@/lib/server/auth';
import { requireCompanyRole } from '@/lib/server/company-auth';
import { getCompany, saveCompany } from '@/lib/server/companies';
import { employerPagesIfReady, employerPageSuppressed } from '@/lib/server/employers';
import { companyPublicPath } from '@/lib/server/company-public-path';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const company = await requireCompanyRole();
    const [profile, directory] = await Promise.all([
      getCompany(company.name),
      employerPagesIfReady(),
    ]);
    const publicPath = await companyPublicPath(
      company.companyKey, directory?.bySlug.values() ?? null, employerPageSuppressed,
    );
    return Response.json({ ...profile, publicPath }, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const company = await requireCompanyRole(['owner'], true);
    const data = await readBody(req);
    for (const key of ['website', 'logoUrl']) {
      if (typeof data[key] !== 'string' || !data[key]) continue;
      if (key === 'logoUrl' && isLocalLogoUrl(data[key])) continue;
      const normalized = safeExternalUrl(data[key].trim());
      if (!normalized) throw new ApiError('მიუთითეთ სწორი https ბმული.');
      data[key] = normalized;
    }
    const saved = await saveCompany(
      { ...data, name: company.name },
      { accountId: company.id, companyKey: company.companyKey },
    );
    revalidateTag('company-branding', { expire: 0 });
    return Response.json(saved,
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (e) {
    return apiError(e);
  }
}
