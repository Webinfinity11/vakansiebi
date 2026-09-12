/* A sliding window counter for public read endpoints.

   The admin login is limited through a table and an advisory lock, which is right for eight
   attempts in fifteen minutes. Search suggestions are the opposite shape: a request per
   keystroke, cheap to answer and pointless to record, so a database round trip per request
   would add the load the limit exists to prevent. This keeps the window in the instance's own
   memory instead.

   What that does and does not buy: it bounds one client hammering one instance, which is the
   case that hurts a shared database. It is not a global quota — a serverless deployment runs
   several instances and each keeps its own counters, so the effective ceiling is the limit
   times the number of instances. Anything stricter needs shared state, and the endpoint is
   not worth that: it reads public data and is cacheable at the edge. */
type Window = { started: number; hits: number };
const windows = new Map<string, Window>();
/* Bounded so a stream of distinct keys cannot grow the map without end; the oldest entry goes
   first, and an entry is only ever a counter and a timestamp. */
const maxKeys = 5000;

export type RateLimit = { allowed: boolean; retryAfterSeconds: number };

export function rateLimit(
  key: string,
  {
    limit,
    windowMs,
    now = Date.now(),
  }: { limit: number; windowMs: number; now?: number },
): RateLimit {
  const existing = windows.get(key);
  if (!existing || now - existing.started >= windowMs) {
    if (windows.size >= maxKeys) {
      const oldest = windows.keys().next();
      if (!oldest.done) windows.delete(oldest.value);
    }
    windows.delete(key);
    windows.set(key, { started: now, hits: 1 });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  existing.hits += 1;
  if (existing.hits <= limit) return { allowed: true, retryAfterSeconds: 0 };
  return {
    allowed: false,
    retryAfterSeconds: Math.max(
      1,
      Math.ceil((existing.started + windowMs - now) / 1000),
    ),
  };
}

/* Only for tests: the module keeps its state for the life of the instance. */
export function resetRateLimits() {
  windows.clear();
}

/* Vercel and every proxy in front of it set x-forwarded-for; the first entry is the client.
   A request without one is rare and shares the "unknown" bucket rather than escaping the
   limit, which is the safer way to be wrong. */
export function clientKey(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for');
  const first = forwarded?.split(',')[0]?.trim();
  return first || request.headers.get('x-real-ip')?.trim() || 'unknown';
}

/* A ceiling on how many of one kind of request may be in the database at once.

   The pool holds five connections for the whole application. A burst of suggestion queries
   large enough to take all five starves page loads as well — measured: forty concurrent
   suggestion requests produced nineteen "timeout exceeded when trying to connect" failures.
   Counting requests per client does not prevent that, because the burst can come from many
   clients; the fix is to refuse the work rather than queue it on a connection nobody else can
   then have. Reads that are cheap and repeatable are the right thing to refuse. */
const inFlight = new Map<string, number>();

export function withLimitedConcurrency<T>(
  name: string,
  max: number,
  work: () => Promise<T>,
): Promise<T> | null {
  const running = inFlight.get(name) ?? 0;
  if (running >= max) return null;
  inFlight.set(name, running + 1);
  return work().finally(() => {
    const left = (inFlight.get(name) ?? 1) - 1;
    if (left <= 0) inFlight.delete(name);
    else inFlight.set(name, left);
  });
}

/* Only for tests. */
export function resetConcurrency() {
  inFlight.clear();
}
