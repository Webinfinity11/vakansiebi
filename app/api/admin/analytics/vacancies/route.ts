import { z } from 'zod';
import { apiError, requireAdmin } from '@/lib/server/auth';
import {
  vacancyAnalytics,
  vacancyDailySeries,
} from '@/lib/server/vacancy-analytics';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    await requireAdmin();
    const params = new URL(request.url).searchParams;
    const ids = z
      .array(z.uuid())
      .min(1)
      .max(100)
      .parse((params.get('ids') || '').split(','));
    const unique = [...new Set(ids.map((id) => id.toLowerCase()))];
    // The daily series is read only for the one open vacancy, never for a whole list.
    const [counts, series] = await Promise.all([
      vacancyAnalytics(unique),
      params.get('series') === '1' && unique.length === 1
        ? vacancyDailySeries(unique)
        : {},
    ]);
    return Response.json(
      Object.fromEntries(
        Object.entries(counts).map(([id, value]) => [
          id,
          { ...value, series: (series as Record<string, unknown>)[id] },
        ]),
      ),
      {
        headers: { 'Cache-Control': 'private, no-store' },
      },
    );
  } catch (error) {
    return apiError(error);
  }
}
