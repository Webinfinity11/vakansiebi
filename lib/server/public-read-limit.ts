import { createHmac, randomBytes } from 'node:crypto';
import { clientNetwork } from './login-attempts';
import { clientKey, rateLimit } from './rate-limit';

type Policy = { name: string; minute: number; hour: number };
const localSecret = randomBytes(32).toString('hex');

export function publicReadPolicy(path: string): Policy | null {
  path = path.replace(/\/+$/, '') || '/';
  if (path === '/api/map') return { name: 'map', minute: 6, hour: 60 };
  if (
    /^\/api\/(jobs(?:\/[^/]+\/similar)?|catalogue|company-links|landing-facts|popular-searches|posting-options|suggest)$/.test(
      path,
    )
  )
    return { name: 'api', minute: 120, hour: 1500 };
  if (path === '/' || /^\/(vacancies|companies)(\/[^/]+)?$/.test(path))
    return { name: 'pages', minute: 240, hour: 3000 };
  return null;
}

// Both windows are updated atomically; rejected requests never prolong the ban.
export const publicReadScript = `
local retry = 0
for i = 1, #KEYS do
  local hits = redis.call('INCR', KEYS[i])
  local ttl = redis.call('PTTL', KEYS[i])
  if ttl < 0 then
    redis.call('PEXPIRE', KEYS[i], ARGV[i * 2])
    ttl = tonumber(ARGV[i * 2])
  end
  if hits > tonumber(ARGV[i * 2 - 1]) then
    retry = math.max(retry, ttl)
  end
end
return retry
`;

function refused(status: number, seconds: number) {
  return Response.json(
    {
      error:
        'ძალიან ბევრი მოთხოვნაა ან სერვისი დროებით მიუწვდომელია. სცადე მოგვიანებით.',
    },
    {
      status,
      headers: {
        'Retry-After': String(seconds),
        'Cache-Control': 'private, no-store',
        'X-Robots-Tag': 'noindex',
      },
    },
  );
}

// Runs in Proxy, before route/CDN responses. Never trust a User-Agent or
// prefetch header as an exemption: a scraper can supply either one.
export async function limitPublicRead(
  request: Request,
): Promise<Response | null> {
  if (request.method !== 'GET' && request.method !== 'HEAD') return null;
  const policy = publicReadPolicy(new URL(request.url).pathname);
  if (!policy) return null;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const address =
    process.env.VERCEL === '1'
      ? request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ||
        clientKey(request)
      : clientKey(request);
  const tag = createHmac(
    'sha256',
    process.env.SESSION_SECRET || token || localSecret,
  )
    .update(clientNetwork(address))
    .digest('hex');
  const keys = ['minute', 'hour'].map(
    (window) => `public-read:v1:{${tag}}:${policy.name}:${window}`,
  );
  if (url || token) {
    try {
      if (!url || !token || new URL(url).protocol !== 'https:')
        throw new Error('configuration');
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          'EVAL',
          publicReadScript,
          2,
          ...keys,
          policy.minute,
          60000,
          policy.hour,
          3600000,
        ]),
        cache: 'no-store',
        signal: AbortSignal.timeout(1500),
      });
      if (!response.ok) throw new Error('store unavailable');
      const { result, error } = await response.json();
      if (
        error ||
        !Number.isSafeInteger(result) ||
        result < 0 ||
        result > 3600000
      )
        throw new Error('invalid result');
      return result > 0
        ? refused(429, Math.max(1, Math.ceil(result / 1000)))
        : null;
    } catch {
      // Do not silently disable configured shared protection during an outage.
      console.error('Public read rate limit store unavailable');
      return refused(503, 5);
    }
  }
  // No external service is required for local protection. This fallback is
  // per instance only; configure Redis for a quota shared across instances.
  const minute = rateLimit(keys[0], { limit: policy.minute, windowMs: 60000 });
  const hour = rateLimit(keys[1], { limit: policy.hour, windowMs: 3600000 });
  const retry = Math.max(minute.retryAfterSeconds, hour.retryAfterSeconds);
  return retry ? refused(429, retry) : null;
}
