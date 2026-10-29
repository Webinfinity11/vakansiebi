import { timingSafeEqual } from 'node:crypto';
import { prepareJobDigests, deliverJobAlerts } from '@/lib/server/job-alerts';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const supplied = Buffer.from(request.headers.get('authorization') || '');
  const expected = Buffer.from(`Bearer ${secret || ''}`);
  if (
    !secret ||
    secret.length < 32 ||
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  )
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const prepared = await prepareJobDigests({ limit: 40 });
    const delivery = await deliverJobAlerts({ limit: 40 });
    return Response.json(
      { ...prepared, ...delivery },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return Response.json({ error: 'Alert delivery deferred' }, { status: 503 });
  }
}
