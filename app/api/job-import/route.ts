import { apiError, ApiError, checkOrigin } from '@/lib/server/auth';
import { readJobImportFile } from '@/lib/server/job-import-file';
import { clientKey, rateLimit } from '@/lib/server/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };
export async function POST(req: Request) {
  let retryAfter = 0;
  try {
    checkOrigin(req);
    const key = clientKey(req);
    const minute = rateLimit('job-import:m:' + key, {
      limit: 5,
      windowMs: 60000,
    });
    const hour = rateLimit('job-import:h:' + key, {
      limit: 30,
      windowMs: 3600000,
    });
    if (!minute.allowed || !hour.allowed) {
      retryAfter = Math.max(minute.retryAfterSeconds, hour.retryAfterSeconds);
      throw new ApiError('ძალიან ბევრი მცდელობაა. სცადეთ მოგვიანებით.', 429);
    }
    return Response.json(await readJobImportFile(req), { headers });
  } catch (error) {
    const response = apiError(error);
    response.headers.set('Cache-Control', headers['Cache-Control']);
    if (retryAfter) response.headers.set('Retry-After', String(retryAfter));
    return response;
  }
}
