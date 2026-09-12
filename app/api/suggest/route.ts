import { suggestTerms } from '@/lib/server/suggest';
import { apiError } from '@/lib/server/auth';
import {
  clientKey,
  rateLimit,
  withLimitedConcurrency,
} from '@/lib/server/rate-limit';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    const q = new URL(request.url).searchParams.get('q');
    if (q === null)
      return Response.json(
        { error: 'q პარამეტრი აუცილებელია' },
        { status: 400 },
      );
    /* A person typing produces a request every 200ms at most, so roughly five in this window;
       twelve leaves that untouched and still bounds a client hammering one instance. */
    const limit = rateLimit(clientKey(request), {
      limit: 12,
      windowMs: 10_000,
    });
    if (!limit.allowed)
      return Response.json(
        { error: 'ძალიან ბევრი მოთხოვნა. სცადე ერთ წამში.' },
        {
          status: 429,
          headers: { 'Retry-After': String(limit.retryAfterSeconds) },
        },
      );
    /* Two at a time out of the pool's five connections, so suggestions can never be the
       reason a page fails to load. A refused suggestion costs the reader nothing: the panel
       keeps what it has and the next keystroke asks again. */
    const running = withLimitedConcurrency('suggest', 2, () => suggestTerms(q));
    if (!running)
      return Response.json(
        { error: 'ძებნა დატვირთულია. სცადე ერთ წამში.' },
        { status: 429, headers: { 'Retry-After': '1' } },
      );
    const suggestions = await running;
    return Response.json(
      { suggestions },
      {
        headers: {
          /* The same prefix is typed by many people; served from the edge it never reaches
             this function, which is a better limit than any counter here. */
          'Cache-Control':
            'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
        },
      },
    );
  } catch (e) {
    return apiError(e);
  }
}
