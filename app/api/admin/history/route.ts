import { apiError, requireAdmin } from '@/lib/server/auth';
import { auditHistory } from '@/lib/server/audit-history';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  try {
    await requireAdmin();
    const p = new URL(req.url).searchParams;
    return Response.json(
      await auditHistory({
        scope: p.get('scope') || (p.get('job') ? 'all' : 'people'),
        job: p.get('job'),
        before: p.get('before'),
      }),
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (e) {
    return apiError(e);
  }
}
