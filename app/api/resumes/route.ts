import { apiError, ApiError, checkOrigin } from '@/lib/server/auth';
import { clientKey, rateLimit } from '@/lib/server/rate-limit';
import { deleteResume, readResumeBody, saveResume } from '@/lib/server/resumes';

export const runtime = 'nodejs';

async function handle(request: Request, remove: boolean) {
  try {
    checkOrigin(request);
    const rate = rateLimit(
      `resume:${remove ? 'delete' : 'save'}:${clientKey(request)}`,
      { limit: 20, windowMs: 60000 },
    );
    if (!rate.allowed) throw new ApiError('სცადე მოგვიანებით', 429);
    const input = await readResumeBody(request);
    if (remove) await deleteResume(input);
    else await saveResume(input);
    return Response.json(
      { ok: true },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return apiError(e);
  }
}
export const POST = (request: Request) => handle(request, false);
export const DELETE = (request: Request) => handle(request, true);
