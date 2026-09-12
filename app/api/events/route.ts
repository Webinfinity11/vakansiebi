import { ApiError, apiError, readBody } from '@/lib/server/auth';
import { normalizeEvent, recordEvent } from '@/lib/server/analytics';
import { clientKey, rateLimit } from '@/lib/server/rate-limit';
export const dynamic = 'force-dynamic';

/* The site answers on more than one hostname, and a visitor on either is sending from the page
   they are on. Accepting the request's own origin as well as APP_URL keeps both; a page on any
   other site still sends its own origin and is refused. */
function sameSite(request: Request) {
  const origin = request.headers.get('origin');
  const own = new URL(request.url).origin;
  const configured = process.env.APP_URL
    ? new URL(process.env.APP_URL).origin
    : own;
  return origin === own || origin === configured;
}

export async function POST(request: Request) {
  try {
    if (!sameSite(request))
      throw new ApiError('მოთხოვნის წყარო დაუშვებელია', 403);
    // A reader produces a handful of events a minute; this only stops a script.
    if (!rateLimit(clientKey(request), { limit: 60, windowMs: 60_000 }).allowed)
      return new Response(null, { status: 429 });
    const body = await readBody(request);
    const event = normalizeEvent(body?.kind, body?.value);
    if (!event) throw new ApiError('არასწორი მოვლენა');
    await recordEvent(event.kind, event.value);
    return new Response(null, { status: 204 });
  } catch (e) {
    return apiError(e);
  }
}
