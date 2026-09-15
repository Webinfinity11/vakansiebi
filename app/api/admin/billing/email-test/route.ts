import { z } from 'zod';
import { invoiceContact } from '@/lib/billing';
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
    const { email, requestId } = z
      .object({
        email: z.email().max(254),
        requestId: z.uuid(),
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
    const text = `JOBX — ელფოსტის გაგზავნის შემოწმება\n\nეს სატესტო წერილია და გადახდას არ საჭიროებს.\nინვოისები გამოიგზავნება მისამართიდან ${invoiceContact.email}.\n\nინვოისთან ან გადახდასთან დაკავშირებით დაგვიკავშირდით: ${invoiceContact.phone}.\nhttps://jobx.ge`;
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `jobx-invoice-test/${requestId}`,
      },
      body: JSON.stringify({
        from: `JOBX <${invoiceContact.email}>`,
        to: [email],
        reply_to: invoiceContact.email,
        subject: 'JOBX — სატესტო წერილი',
        text,
        html: `<div lang="ka" style="font-family:Arial,sans-serif;max-width:600px;margin:24px auto;padding:28px;color:#202b3d"><h1>JOBX</h1><h2>ელფოსტის გაგზავნის შემოწმება</h2><p>ეს სატესტო წერილია და გადახდას არ საჭიროებს.</p><p>ინვოისები გამოიგზავნება მისამართიდან ${invoiceContact.email}.</p><hr><p>ინვოისთან ან გადახდასთან დაკავშირებით დაგვიკავშირდით:<br><a href="tel:${invoiceContact.telephone}">${invoiceContact.phone}</a></p><a href="https://jobx.ge">jobx.ge</a></div>`,
      }),
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
