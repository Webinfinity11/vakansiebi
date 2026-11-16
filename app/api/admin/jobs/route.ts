import { db } from '@/lib/server/db';
import { recordJobRejection } from '@/lib/server/job-rejections';
import { deliverNotifications } from '@/lib/server/notification-email';
import { rejectionSchema } from '@/lib/job-rejection';
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
    const result = await adminJobs(
        p.get('status') || 'review',
        (p.get('q') || '').slice(0, 200),
        Math.max(1, Math.min(10000, Number(p.get('page')) || 1)),
        p.get('source') && p.get('source')! in listingSourceNames
          ? p.get('source')!
          : '',
        z.uuid().safeParse(p.get('id')).success ? p.get('id') : null,
      );
    const ids = result.jobs.filter(job => job.status === 'rejected').map(job => job.id);
    const reasons = ids.length ? (await db().query(
      'SELECT job_id,reason,note,created_at AS "createdAt" FROM job_rejections WHERE job_id=ANY($1::uuid[])', [ids],
    )).rows : [];
    const byId = new Map(reasons.map(row => [row.job_id, row]));
    return Response.json({ ...result, jobs: result.jobs.map(job => ({
      ...job,
      rejection: byId.get(job.id) ?? null,
      autoPublished: { at: job.auto_published_at ?? null, reviewed: job.auto_publish_reviewed_at ?? null },
    })) });
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(req: Request) {
  try {
    await requireAdmin();
    checkOrigin(req);
    const input = await readBody(req);
    const body = z.object({ action: z.string(), id: z.uuid().optional(), reason: z.unknown().optional(), note: z.unknown().optional() }).parse(input);
    // Read separately: mutateJob intentionally strips unknown input fields.
    if (body.action === 'reject' && (body.reason !== undefined || body.note !== undefined)) rejectionSchema.parse(body);
    let rejectionEmailQueued = false;
    const result = await mutateJob(input, undefined, body.action === 'reject' ? async client => {
      rejectionEmailQueued = await recordJobRejection(client, body.id!, { reason: body.reason, note: body.note });
    } : undefined);
    if (rejectionEmailQueued) after(() => deliverNotifications(5).then(() => {}).catch(() => {
      console.error('Rejection email delivery deferred');
    }));
    if (result.publicationEmailQueued)
      after(() =>
        deliverPublicationEmails(result.jobId)
          .then(() => {})
          .catch(() => {
            console.error('Publication email delivery deferred');
          }),
      );
    return Response.json({ ...result, rejectionEmailQueued });
  } catch (e) {
    return apiError(e);
  }
}
