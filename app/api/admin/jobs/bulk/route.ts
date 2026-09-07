import { bulkPublishCandidates, bulkPublishJobs } from '@/lib/server/jobs';
import {
  requireAdmin,
  checkOrigin,
  readBody,
  apiError,
} from '@/lib/server/auth';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export async function GET() {
  try {
    await requireAdmin();
    return Response.json({ items: await bulkPublishCandidates() });
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(req: Request) {
  try {
    await requireAdmin();
    checkOrigin(req);
    return Response.json(await bulkPublishJobs(await readBody(req)));
  } catch (error) {
    return apiError(error);
  }
}
