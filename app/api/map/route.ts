import { apiError } from '@/lib/server/auth';
import { mapVacancies } from '@/lib/server/job-map';

export const dynamic = 'force-dynamic';
/* Pins change only when the worker places new vacancies, so a few minutes at the edge is safe. */
export async function GET() {
  try {
    return Response.json(
      { vacancies: await mapVacancies() },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      },
    );
  } catch (e) {
    return apiError(e);
  }
}
