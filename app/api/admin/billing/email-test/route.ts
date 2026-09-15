import { z } from 'zod';
import { invoiceEmail } from '@/lib/invoice-email';
import { getInvoice } from '@/lib/server/billing';
import {
  apiError,
  ApiError,
  requireAdmin,
  checkOrigin,
  readBody,
} from '@/lib/server/auth';
import { clientKey, rateLimit } from '@/lib/server/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 15;

export async function POST(request: Request) {
  try {
    await requireAdmin();
    checkOrigin(request);
    const { email, requestId, invoiceToken } = z
      .object({
        email: z.email().max(254),
        requestId: z.uuid(),
        invoiceToken: z.string().regex(/^[a-f0-9]{64}$/),
      })
      .parse(await readBody(request));
    if (
      !rateLimit(`invoice-email-test:${clientKey(request)}`, {
        limit: 6,
        windowMs: 3600000,
      }).allowed
    )
      throw new ApiError(
        'სატესტო წერილების ლიმიტი ამოიწურა. სცადე ერთ საათში.',
        429,
      );
    if (!process.env.RESEND_API_KEY)
      throw new ApiError(
        'ელფოსტის გაგზავნის სერვისი ჯერ არ არის დაკავშირებული.',
        503,
      );
    const invoice = await getInvoice(invoiceToken);
    if (!invoice) throw new ApiError('ინვოისი ვერ მოიძებნა.', 404);
    const payload = invoiceEmail(
      invoice,
      email,
      process.env.APP_URL || 'https://jobx.ge',
      email,
      true,
    );
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `jobx-invoice-test/${requestId}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || typeof result.id !== 'string')
      throw new ApiError(
        'სერვისმა წერილი ვერ მიიღო. გადაამოწმე დომენი და გაგზავნის ლიმიტი Resend-ში.',
        502,
      );
    return Response.json(
      { id: result.id },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return apiError(error);
  }
}
