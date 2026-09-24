import { apiError, requireAdmin } from '@/lib/server/auth';
import { submissionPerformance } from '@/lib/server/vacancy-analytics';

export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    await requireAdmin();
    return Response.json(
      { vacancies: await submissionPerformance() },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return apiError(error);
  }
}
