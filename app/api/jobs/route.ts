import { publicJobs } from '@/lib/server/jobs';
import { apiError, requireAdmin } from '@/lib/server/auth';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    const p = new URL(request.url).searchParams;
    const preview = p.get('preview') === '1';
    if (preview) await requireAdmin();
    return Response.json(await publicJobs(p, preview));
  } catch (e) {
    return apiError(e);
  }
}
