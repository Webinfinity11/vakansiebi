import { maxCvBytes } from '@/lib/cv-upload';
import { apiError, ApiError, checkOrigin } from '@/lib/server/auth';
import { requireCompanyRole } from '@/lib/server/company-auth';
import { uploadCandidate } from '@/lib/server/company-candidates';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const company = await requireCompanyRole(['owner', 'recruiter'], true);
    if (Number(req.headers.get('content-length') ?? 0) > maxCvBytes + 64 * 1024)
      throw new ApiError('ფაილი 4 MB-ზე დიდი არ უნდა იყოს.', 413);
    return Response.json(await uploadCandidate(company, await req.formData()), {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (e) {
    return apiError(e);
  }
}
