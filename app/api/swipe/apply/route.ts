import { apiError, ApiError, checkOrigin } from '@/lib/server/auth';
import { clientKey, rateLimit } from '@/lib/server/rate-limit';
import {
  readSwipeForm,
  sendSwipeApplication,
  swipeApplyEnabled,
} from '@/lib/server/swipe-apply';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* One CV, one vacancy: the deck calls this when its held send runs out. */
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    if (!swipeApplyEnabled())
      throw new ApiError('გაგზავნა ამჟამად მიუწვდომელია', 503);
    const client = clientKey(request);
    const rate = rateLimit(`swipe:apply:${client}`, {
      limit: 6,
      windowMs: 60000,
    });
    if (!rate.allowed) throw new ApiError('სცადე მოგვიანებით', 429);
    const form = await readSwipeForm(request);
    const sent = await sendSwipeApplication(form, client);
    return Response.json(
      { ok: true, to: sent.to },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return apiError(e);
  }
}
