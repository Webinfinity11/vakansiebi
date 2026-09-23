import { z } from 'zod';
import { apiError, requireAdmin } from '@/lib/server/auth';
import { vacancyAnalytics } from '@/lib/server/vacancy-analytics';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    await requireAdmin();
    const ids = z
      .array(z.uuid())
      .min(1)
      .max(100)
      .parse((new URL(request.url).searchParams.get('ids') || '').split(','));
    return Response.json(
      await vacancyAnalytics([...new Set(ids.map((id) => id.toLowerCase()))]),
      {
        headers: { 'Cache-Control': 'private, no-store' },
      },
    );
  } catch (error) {
    return apiError(error);
  }
}
