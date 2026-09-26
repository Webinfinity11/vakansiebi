import { apiError, ApiError, checkOrigin } from '@/lib/server/auth';
import { clientKey, rateLimit } from '@/lib/server/rate-limit';
import { readResumeBody, recordResumeContact } from '@/lib/server/resumes';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const rate = rateLimit(`resume:contact:${clientKey(request)}`, {
      limit: 30,
      windowMs: 60000,
    });
    if (!rate.allowed) throw new ApiError('სცადე მოგვიანებით', 429);
    await recordResumeContact(await readResumeBody(request));
    return new Response(null, {
      status: 204,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    return apiError(e);
  }
}
