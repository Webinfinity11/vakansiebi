import { timingSafeEqual } from 'node:crypto';
import { deliverInvoiceEmails } from '@/lib/server/invoice-email';
import { deliverPublicationEmails } from '@/lib/server/publication-email';
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
    const [invoices, publications] = await Promise.all([
      deliverInvoiceEmails(undefined, 5),
      deliverPublicationEmails(undefined, 5),
    ]);
    return Response.json(
      { ...invoices, publications },
      {
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  } catch {
    return Response.json({ error: 'Email delivery deferred' }, { status: 503 });
  }
}
