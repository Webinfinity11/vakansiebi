import { apiError, ApiError, checkOrigin } from '@/lib/server/auth';
import { clientKey, rateLimit } from '@/lib/server/rate-limit';
import { priorSubmission, submitJob } from '@/lib/server/job-submissions';
import { submissionSchema } from '@/lib/job-submission';
import { z } from 'zod';
import { after } from 'next/server';
import { deliverInvoiceEmails } from '@/lib/server/invoice-email';
import { maxSubmissionBytes } from '@/lib/submission-logo';
import {
  readSubmissionLogo,
  SubmissionLogoError,
} from '@/lib/server/submission-logos';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    checkOrigin(req);
    if (!req.headers.get('content-type')?.startsWith('application/json'))
      throw new ApiError('არასწორი მოთხოვნა', 415);
    const client = clientKey(req);
    const limit = rateLimit(`submit:${client}`, {
      limit: 20,
      windowMs: 3600000,
    });
    if (!limit.allowed)
      return Response.json(
        { error: 'ძალიან ბევრი მცდელობაა. სცადე მოგვიანებით.' },
        {
          status: 429,
          headers: { 'Retry-After': String(limit.retryAfterSeconds) },
        },
      );
    // Bound actual streamed bytes, even when a caller omits Content-Length.
    const reader = req.body?.getReader();
    if (!reader) throw new ApiError('შეავსე განცხადება');
    let size = 0;
    const chunks: Uint8Array[] = [];
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maxSubmissionBytes) {
          await reader.cancel();
          throw new ApiError(
            'განცხადება და ლოგო ერთად მეტისმეტად დიდია. შეამცირე ტექსტი ან მოაცილე ლოგო.',
            413,
          );
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    let input: unknown;
    try {
      input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      throw new ApiError('არასწორი მოთხოვნა');
    }
    const parsed = submissionSchema.safeParse(input);
    if (!parsed.success) {
      if (
        parsed.error.issues.length > 0 &&
        parsed.error.issues.every(
          (issue) =>
            issue.path[0] === 'deadline' || issue.path[0] === 'billingEmail',
        )
      ) {
        const requestId = z
          .uuid()
          .safeParse(
            input && typeof input === 'object' && 'requestId' in input
              ? input.requestId
              : undefined,
          );
        if (requestId.success) {
          await readSubmissionLogo(
            'logo' in (input as object)
              ? (input as { logo: unknown }).logo
              : '',
          );
          // A retry can fail time-dependent deadline rules the next day even
          // though the submission was created: return the accepted version.
          const prior = await priorSubmission(requestId.data);
          if (prior) {
            if (prior.invoiceUrl)
              after(() =>
                deliverInvoiceEmails(prior.id)
                  .then(() => {})
                  .catch(() => {
                    console.error('Invoice email delivery deferred');
                  }),
              );
            return Response.json(prior, {
              status: 200,
              headers: { 'Cache-Control': 'no-store' },
            });
          }
        }
      }
      return Response.json(
        {
          error: 'შეამოწმე მონიშნული ველები',
          fields: Object.fromEntries(
            parsed.error.issues.map((i) => [i.path[0], i.message]),
          ),
        },
        { status: 400 },
      );
    }
    const result = await submitJob(parsed.data, client);
    if (result.invoiceUrl)
      after(() =>
        deliverInvoiceEmails(result.id)
          .then(() => {})
          .catch(() => {
            console.error('Invoice email delivery deferred');
          }),
      );
    return Response.json(result, {
      status: 'alreadyReceived' in result && result.alreadyReceived ? 200 : 201,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    if (e instanceof SubmissionLogoError)
      return Response.json(
        { error: 'შეამოწმე მონიშნული ველები', fields: { logo: e.message } },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    return apiError(e);
  }
}
