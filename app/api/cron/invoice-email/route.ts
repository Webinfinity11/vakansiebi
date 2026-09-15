import { timingSafeEqual } from 'node:crypto';
import { deliverInvoiceEmails } from '@/lib/server/invoice-email';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const provided = Buffer.from(request.headers.get('authorization') || '');
  const expected = Buffer.from(`Bearer ${secret || ''}`);
  if (
    !secret ||
    secret.length < 32 ||
    provided.length !== expected.length ||
    !timingSafeEqual(provided, expected)
  )
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    return Response.json(await deliverInvoiceEmails(undefined, 5), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return Response.json(
      { error: 'Invoice email delivery deferred' },
      { status: 503 },
    );
  }
}
