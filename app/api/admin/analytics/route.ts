import { apiError, requireAdmin } from '@/lib/server/auth';
import { analyticsSummary } from '@/lib/server/analytics';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    await requireAdmin();
    const days = Number(new URL(request.url).searchParams.get('days'));
    const window = [7, 30, 90, 365].includes(days) ? days : 30;
    return Response.json(await analyticsSummary(window), {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (e) {
    return apiError(e);
  }
}
