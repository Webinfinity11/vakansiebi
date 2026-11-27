import { revalidateTag } from 'next/cache';
import { apiError, ApiError, checkOrigin } from '@/lib/server/auth';
import { requireCompanyRole } from '@/lib/server/company-auth';
import { getCompany, saveCompany } from '@/lib/server/companies';
import { readCompanyLogo } from '@/lib/server/company-logo-upload';
import { storeSubmissionLogo } from '@/lib/server/submission-logos';
import { transaction } from '@/lib/server/db';
import { clientKey, rateLimit } from '@/lib/server/rate-limit';
import { maxLogoBytes } from '@/lib/submission-logo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };

async function changeLogo(req: Request, remove: boolean) {
  try {
    checkOrigin(req);
    const company = await requireCompanyRole(['owner', 'recruiter']);
    if (!rateLimit('company-logo:' + clientKey(req), { limit: 10, windowMs: 60000 }).allowed)
      throw new ApiError('სცადეთ მოგვიანებით.', 429);
    if (Number(req.headers.get('content-length')) > maxLogoBytes + 100000)
      throw new ApiError('ფაილი მეტისმეტად დიდია.', 413);
    const data = await req.formData();
    const version = data.get('version');
    if (typeof version !== 'string' || !/^\d+$/.test(version) || !Number.isSafeInteger(Number(version)))
      throw new ApiError('გახსენით კომპანიის გვერდი ხელახლა.', 409);
    const profile = await getCompany(company.name);
    if (profile.version !== Number(version))
      throw new ApiError('კომპანიის მონაცემები შეიცვალა. გახსენით გვერდი ხელახლა.', 409);
    let logoUrl = '';
    if (!remove) {
      const logo = await readCompanyLogo(data.get('file'));
      logoUrl = await transaction(async (client) => {
        const url = await storeSubmissionLogo(client, logo);
        // Authenticated company uploads are public immediately, unlike anonymous submissions.
        await client.query('UPDATE submission_logos SET approved_at=COALESCE(approved_at,now()) WHERE hash=$1', [logo.hash]);
        return url;
      });
    }
    const saved = await saveCompany({ ...profile, logoUrl }, {
      accountId: company.id, companyKey: company.companyKey,
    });
    revalidateTag('company-branding', { expire: 0 });
    return Response.json({ logoUrl: saved.logoUrl, version: saved.version }, { headers });
  } catch (error) {
    const response = apiError(error);
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  }
}

export async function POST(req: Request) { return changeLogo(req, false); }
export async function DELETE(req: Request) { return changeLogo(req, true); }
