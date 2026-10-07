import { apiError, requireAdmin } from '@/lib/server/auth';
import { indexingQueueStatus } from '@/lib/server/indexing-queue';
import { indexingDailyLimit } from '@/lib/server/google-indexing';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireAdmin();
    return Response.json({
      ...(await indexingQueueStatus()),
      dailyLimit: indexingDailyLimit(process.env.GOOGLE_INDEXING_DAILY_LIMIT),
    });
  } catch (error) {
    return apiError(error);
  }
}
