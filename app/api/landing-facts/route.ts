import { landingFor } from '@/lib/seo-landing';
import { landingFacts } from '@/lib/server/landing-facts';
export const dynamic = 'force-dynamic';

/* The summary under a landing list, for a reader who reached it by changing
   filters on the board. A first visit has it in the page's own HTML. */
export async function GET(request: Request) {
  const landing = landingFor(new URL(request.url).searchParams);
  if (!landing) return Response.json(null, { status: 404 });
  try {
    return Response.json(await landingFacts(landing), {
      headers: {
        'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=86400',
      },
    });
  } catch {
    return Response.json(null, { status: 503 });
  }
}
