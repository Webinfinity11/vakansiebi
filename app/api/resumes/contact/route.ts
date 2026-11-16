import { after } from 'next/server';
import { notifyApplication } from '@/lib/server/notification-jobs';
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
    const input = await readResumeBody(request);
    await recordResumeContact(input);
    after(() => notifyApplication({ jobId: (input as { job: string }).job }));
    return new Response(null, {
      status: 204,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    return apiError(e);
  }
}
