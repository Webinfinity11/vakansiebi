import { apiError, requireAdmin } from '@/lib/server/auth';
import {
  postingAnalytics,
  postingWindows,
  type PostingWindow,
} from '@/lib/server/posting-analytics';
export const dynamic = 'force-dynamic';

/* The posting form and the submissions it really delivered, for one window of days. */
export async function GET(request: Request) {
  try {
    await requireAdmin();
    const days = Number(new URL(request.url).searchParams.get('days'));
    const window = postingWindows.includes(days as PostingWindow)
      ? (days as PostingWindow)
      : 30;
    return Response.json(await postingAnalytics(window), {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (e) {
    return apiError(e);
  }
}
