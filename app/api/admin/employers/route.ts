import {
  apiError,
  checkOrigin,
  readBody,
  requireAdmin,
} from '@/lib/server/auth';
import {
  decideEmployers,
  employerCandidates,
  employerPages,
} from '@/lib/server/employers';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    await requireAdmin();
    const [candidates, directory] = await Promise.all([
      employerCandidates(),
      employerPages(),
    ]);
    const pages = [...directory.bySlug.values()]
      .map((p) => ({ slug: p.slug, name: p.name, count: p.jobIds.length }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    return Response.json(
      { candidates, pages },
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
