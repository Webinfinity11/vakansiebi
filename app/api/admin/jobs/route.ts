import { adminJobs, mutateJob } from '@/lib/server/jobs';
import { sourceNames } from '@/lib/types';
import {
  apiError,
  requireAdmin,
  checkOrigin,
  readBody,
} from '@/lib/server/auth';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  try {
    await requireAdmin();
    const p = new URL(req.url).searchParams;
    return Response.json(
      await adminJobs(
        p.get('status') || 'review',
        (p.get('q') || '').slice(0, 200),
        Math.max(1, Math.min(10000, Number(p.get('page')) || 1)),
        p.get('source') && p.get('source')! in sourceNames
          ? p.get('source')!
          : '',
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
    return Response.json(await mutateJob(await readBody(req)));
  } catch (e) {
    return apiError(e);
  }
}
