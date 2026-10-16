import { z } from 'zod';
import { after } from 'next/server';
import { deliverPublicationEmails } from '@/lib/server/publication-email';
import { adminJobs, mutateJob } from '@/lib/server/jobs';
import { listingSourceNames } from '@/lib/types';
import {
  apiError,
  requireAdmin,
  checkOrigin,
  readBody,
} from '@/lib/server/auth';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
export async function GET(req: Request) {
  try {
    await requireAdmin();
    const p = new URL(req.url).searchParams;
    return Response.json(
      await adminJobs(
        p.get('status') || 'review',
        (p.get('q') || '').slice(0, 200),
        Math.max(1, Math.min(10000, Number(p.get('page')) || 1)),
        p.get('source') && p.get('source')! in listingSourceNames
          ? p.get('source')!
          : '',
        z.uuid().safeParse(p.get('id')).success ? p.get('id') : null,
      ),
    );
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(req: Request) {
  try {
    await requireAdmin();
    checkOrigin(req);
    const result = await mutateJob(await readBody(req));
    if (result.publicationEmailQueued)
      after(() =>
        deliverPublicationEmails(result.jobId)
          .then(() => {})
          .catch(() => {
            console.error('Publication email delivery deferred');
          }),
      );
    return Response.json(result);
  } catch (e) {
    return apiError(e);
  }
}
