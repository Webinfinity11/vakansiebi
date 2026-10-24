import { z } from 'zod';
import { apiError, ApiError } from '@/lib/server/auth';
import { verifyRemovalWebhook } from '@/lib/employer-opt-out';
import {
  deliverRemovalConfirmations,
  processReceivedRemoval,
} from '@/lib/server/removal-requests';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    if (Number(request.headers.get('content-length')) > 100000)
      throw new ApiError('Request too large', 413);
    const body = await request.text();
    if (body.length > 100000) throw new ApiError('Request too large', 413);
    if (
      !verifyRemovalWebhook(
        body,
        request.headers,
        process.env.RESEND_REMOVALS_WEBHOOK_SECRET || '',
      )
    )
      throw new ApiError('Invalid signature', 401);
    const event = z
      .object({
        type: z.string(),
        data: z
          .object({ email_id: z.uuid(), to: z.array(z.string()).default([]) })
          .optional(),
      })
      .parse(JSON.parse(body));
    if (event.type !== 'email.received' || !event.data)
      return Response.json({ ignored: true });
    const result = await processReceivedRemoval(
      event.data.email_id,
      event.data.to,
    );
    if ('id' in result) {
      const delivery = await deliverRemovalConfirmations(result.id);
      if (delivery.failed) throw new ApiError('Confirmation deferred', 503);
    }
    return Response.json(
      { ok: true },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return apiError(error);
  }
}
