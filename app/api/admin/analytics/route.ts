import { apiError, requireAdmin } from '@/lib/server/auth';
import { analyticsSummary } from '@/lib/server/analytics';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    await requireAdmin();
    const params = new URL(request.url).searchParams;
    const days = Number(params.get('days'));
    const period = params.get('period');
    const window =
      period === 'today' || period === 'yesterday'
        ? period
        : [1, 7, 30, 90, 365].includes(days)
          ? days
          : 7;
    return Response.json(await analyticsSummary(window), {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (e) {
    return apiError(e);
  }
}
