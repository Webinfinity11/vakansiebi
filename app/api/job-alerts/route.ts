import { after } from 'next/server';
import { z } from 'zod';
import { ApiError, apiError, checkOrigin, readBody } from '@/lib/server/auth';
import { clientKey, rateLimit } from '@/lib/server/rate-limit';
import {
  jobAlertsEnabled,
  requestJobAlert,
  deliverJobAlerts,
} from '@/lib/server/job-alerts';
export const dynamic = 'force-dynamic';
export async function GET() {
  return Response.json(
    { enabled: jobAlertsEnabled() },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    if (!jobAlertsEnabled())
      throw new ApiError(
        'გამოწერა დროებით მიუწვდომელია. სცადე მოგვიანებით.',
        503,
      );
    if (
      !rateLimit('alerts:' + clientKey(request), {
        limit: 5,
        windowMs: 3600000,
      }).allowed
    )
      throw new ApiError('მოთხოვნა უკვე მიღებულია. სცადე მოგვიანებით.', 429);
    const body = await readBody(request);
    const email = z.email().max(254).parse(body.email);
    if (body.website) return Response.json({ ok: true });
    const id = await requestJobAlert(email, body.filters);
    if (id)
      after(async () => {
        await deliverJobAlerts({ id, limit: 1 }).catch(() => {});
      });
    return Response.json(
      { ok: true },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return apiError(e);
  }
}
