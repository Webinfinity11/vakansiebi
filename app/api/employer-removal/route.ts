import { createHash } from 'node:crypto';
import { after } from 'next/server';
import { readRemovalToken } from '@/lib/employer-opt-out';
import { apiError, ApiError, checkOrigin } from '@/lib/server/auth';
import { db } from '@/lib/server/db';
import {
  deliverRemovalConfirmations,
  recordRemovalRequest,
} from '@/lib/server/removal-requests';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    if (Number(request.headers.get('content-length')) > 5000)
      throw new ApiError('Request too large', 413);
    const value = (await request.formData()).get('token');
    const token = typeof value === 'string' ? value : '';
    const claim = readRemovalToken(token);
    if (!claim) throw new ApiError('ბმული არ მოქმედებს', 400);
    const job = (
      await db().query(
        "SELECT draft->>'company' company FROM jobs WHERE id=$1",
        [claim.job],
      )
    ).rows[0];
    const stored = (
      await db().query(
        'SELECT company_names FROM employer_suppressions WHERE email=$1',
        [claim.email],
      )
    ).rows[0];
    if (!job && !stored)
      throw new ApiError(
        'ვაკანსია ვეღარ მოიძებნა — მოგვწერეთ hr@jobx.ge-ზე',
        404,
      );
    const result = await recordRemovalRequest({
      sourceId: `link:${createHash('sha256').update(token).digest('hex')}`,
      sender: claim.email,
      source: 'link',
      text: 'დამსაქმებელმა ამოღება ხელმოწერილი ბმულით დაადასტურა',
      authenticated: true,
      companyNames: job?.company ? [job.company] : stored.company_names,
    });
    after(() => deliverRemovalConfirmations(result.id).then(() => {}));
    return new Response(null, {
      status: 303,
      headers: {
        Location: `/employer-removal?token=${encodeURIComponent(token)}&done=1`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
