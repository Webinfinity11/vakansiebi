import { apiError, requireAdmin } from '@/lib/server/auth';
import {
  adminOverview,
  overviewPeriods,
  type OverviewPeriod,
} from '@/lib/server/admin-overview';

export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  try {
    await requireAdmin();
    const asked = Number(new URL(req.url).searchParams.get('days'));
    const days = (overviewPeriods as readonly number[]).includes(asked)
      ? (asked as OverviewPeriod)
      : 1;
    return Response.json(await adminOverview(days), {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (e) {
    return apiError(e);
  }
}
