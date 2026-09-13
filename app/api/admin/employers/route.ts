import {
  apiError,
  checkOrigin,
  readBody,
  requireAdmin,
} from '@/lib/server/auth';
import { decideEmployers, employerCandidates } from '@/lib/server/employers';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    await requireAdmin();
    return Response.json(
      { candidates: await employerCandidates() },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(req: Request) {
  try {
    await requireAdmin();
    checkOrigin(req);
    return Response.json(await decideEmployers(await readBody(req)));
  } catch (e) {
    return apiError(e);
  }
}
