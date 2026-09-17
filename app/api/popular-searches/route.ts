import { popularSearches } from '@/lib/server/popular-searches';

/* Asked for once, when a reader first opens the search field. The list moves
   with the catalogue rather than with the hour, so the edge may hold it. */
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return Response.json(
      { terms: await popularSearches() },
      {
        headers: {
          'cache-control':
            'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
        },
      },
    );
  } catch {
    // An empty list simply leaves the panel to the reader's own history.
    return Response.json({ terms: [] });
  }
}
