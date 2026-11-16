import { apiError, ApiError, checkOrigin } from '@/lib/server/auth';
import { requireCompanyRole } from '@/lib/server/company-auth';
import { uploadCompanyCover } from '@/lib/server/company-covers';
import { clientKey, rateLimit } from '@/lib/server/rate-limit';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const company = await requireCompanyRole(['owner']);
    if (
      !rateLimit('company-cover:' + clientKey(req), {
        limit: 10,
        windowMs: 60000,
      }).allowed
    )
      throw new ApiError('სცადეთ მოგვიანებით.', 429);
    if (Number(req.headers.get('content-length')) > 4 * 1024 * 1024 + 100000)
      throw new ApiError('ფაილი მეტისმეტად დიდია.', 413);
    return Response.json(
      await uploadCompanyCover(company, (await req.formData()).get('file')),
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (e) {
    return apiError(e);
  }
}
