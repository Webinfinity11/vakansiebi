import { publicJobs } from '@/lib/server/jobs';
import { apiError, requireAdmin } from '@/lib/server/auth';
import { cacheHeader } from '@/lib/server/jobs-cache';
import { logPublicLoadFailure } from '@/lib/server/public-load-log';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const started = performance.now();
  try {
    const p = new URL(request.url).searchParams;
    const preview = p.get('preview') === '1';
    if (preview) await requireAdmin();
    return Response.json(await publicJobs(p, preview), {
      headers: { 'Cache-Control': cacheHeader(p) },
    });
  } catch (e) {
    logPublicLoadFailure('jobs', e, started);
    return apiError(e);
  }
}
