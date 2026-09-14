import { z } from 'zod';
import { employerPages } from '@/lib/server/employers';
import { apiError } from '@/lib/server/auth';
export const dynamic = 'force-dynamic';
// Optional links resolve after the results are visible; unpublished IDs have no entry.
export async function GET(request: Request) {
  try {
    const ids = [
      ...new Set(
        (new URL(request.url).searchParams.get('ids') || '')
          .split(',')
          .filter((id) => z.uuid().safeParse(id).success),
      ),
    ].slice(0, 100);
    if (!ids.length) return Response.json({ links: {} });
    const { byJob } = await employerPages();
    return Response.json(
      {
        links: Object.fromEntries(
          ids.map((id) => [
            id,
            byJob.has(id)
              ? `/companies/${encodeURIComponent(byJob.get(id)!)}`
              : null,
          ]),
        ),
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return apiError(error);
  }
}
