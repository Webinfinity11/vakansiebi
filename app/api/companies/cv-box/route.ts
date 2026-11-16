import { after } from 'next/server';
import { notifyApplication } from '@/lib/server/notification-jobs';
import { apiError, ApiError, checkOrigin } from '@/lib/server/auth';
import { clientKey, rateLimit } from '@/lib/server/rate-limit';
import { submitCvBox } from '@/lib/server/company-cv-box';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const client = clientKey(req);
    if (!rateLimit('cv-box:' + client, { limit: 5, windowMs: 60000 }).allowed)
      throw new ApiError('სცადე მოგვიანებით.', 429);
    if (Number(req.headers.get('content-length')) > 6 * 1024 * 1024)
      throw new ApiError('ფაილი მეტისმეტად დიდია.', 413);
    const form = await req.formData();
    const result = await submitCvBox(form, client);
    after(() => notifyApplication({ companyKey: String(form.get('company') || '') }));
    return Response.json(
      { ok: true, duplicate: result.duplicate },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return apiError(e);
  }
}
