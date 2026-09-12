import robotsParser from 'robots-parser';
import { setTimeout as delay } from 'node:timers/promises';
import type { SourceId } from '../lib/types';
import { getSourceConfig, maxResponseBytes } from './adapters';
/** Government hosts are unreachable from some networks (GitHub runners); that is a network fact, not a source failure. */
export function deferredSourceFailure(source: SourceId, error: string) {
  return (
    (source === 'hrgov' || source === 'worknet') &&
    /^Source request failed: (UND_ERR_CONNECT_TIMEOUT|AbortError|TimeoutError)$/.test(
      error,
    )
  );
}
export class SourceHttpError extends Error {
  constructor(public status: number) {
    super(`Source returned HTTP ${status}`);
  }
}
const agent = 'ErtadVacancyBot/0.1';
const robotsCache = new Map<
  string,
  { at: number; rules: ReturnType<typeof robotsParser> }
>();
/**
 * Politeness per host, not per source. The large boards answer in well under a second and
 * one request a second from a single crawler is ordinary browsing load; the small government
 * and classified sites keep the slower default. A robots.txt crawl-delay always wins.
 */
const defaultDelay: Partial<Record<SourceId, number>> = {
  hr: 1000,
  jobs: 1000,
  ss: 1000,
};
export function sourceDelayMs(source: SourceId) {
  const configured = Number(process.env.CRAWL_DELAY_MS);
  return Math.max(
    1000,
    configured > 0 ? configured : defaultDelay[source] || 2000,
  );
}
/**
 * Serialises requests to one host. Concurrent detail workers therefore never fire at the same
 * host together: each waits its turn, then the minimum gap since the previous request.
 */
const hostQueue = new Map<string, Promise<unknown>>();
const lastRequest = new Map<string, number>();
export async function hostTurn(hostname: string, gapMs: number) {
  const previous = hostQueue.get(hostname) || Promise.resolve();
  let release!: () => void;
  const turn = new Promise<void>((resolve) => (release = resolve));
  hostQueue.set(
    hostname,
    previous.then(() => turn),
  );
  await previous.catch(() => {});
  const elapsed = Date.now() - (lastRequest.get(hostname) || 0);
  await delay(Math.max(0, gapMs - elapsed));
  lastRequest.set(hostname, Date.now());
  release();
}
export function validateUrl(source: SourceId, value: string) {
  const u = new URL(value);
  if (
    u.protocol !== 'https:' ||
    u.port ||
    u.username ||
    u.password ||
    !getSourceConfig(source).hosts.includes(u.hostname)
  )
    throw Error('URL is outside allowed source hosts');
  return u;
}
async function rawFetch(
  source: SourceId,
  value: string,
  gapMs: number,
  redirects = 0,
): Promise<{ status: number; text: string }> {
  const url = validateUrl(source, value);
  // A board occasionally bounces through www/locale hops before answering; five is plenty and
  // still stops a loop quickly.
  if (redirects > 5) throw Error('Too many redirects');
  await hostTurn(url.hostname, gapMs);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    let r: Response;
    try {
      r = await fetch(url, {
        headers: {
          'User-Agent': agent,
          Accept: 'text/html,application/xml,text/xml,text/plain',
        },
        redirect: 'manual',
        signal: controller.signal,
      });
    } catch (error) {
      const cause = (error as { cause?: { code?: string } }).cause?.code;
      throw Error(`Source request failed: ${cause || (error as Error).name}`);
    }
    if (r.status >= 300 && r.status < 400 && r.headers.get('location')) {
      await r.body?.cancel();
      return rawFetch(
        source,
        new URL(r.headers.get('location')!, url).href,
        gapMs,
        redirects + 1,
      );
    }
    const limit = maxResponseBytes(source);
    if (Number(r.headers.get('content-length')) > limit) {
      await r.body?.cancel();
      throw Error('Source response too large');
    }
    const reader = r.body?.getReader();
    let size = 0;
    const chunks: Uint8Array[] = [];
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > limit) {
          await reader.cancel();
          throw Error('Source response too large');
        }
        chunks.push(value);
      }
    }
    return { status: r.status, text: Buffer.concat(chunks).toString('utf8') };
  } finally {
    clearTimeout(timer);
  }
}
const robotsLoading = new Map<string, Promise<void>>();
export async function sourceFetch(source: SourceId, value: string) {
  const url = validateUrl(source, value);
  const gapMs = sourceDelayMs(source);
  let cached = robotsCache.get(url.origin);
  if (!cached || Date.now() - cached.at > 3600000) {
    // Concurrent workers share one robots.txt request per origin.
    let loading = robotsLoading.get(url.origin);
    if (!loading) {
      loading = (async () => {
        const robotsUrl = url.origin + '/robots.txt';
        const r = await rawFetch(source, robotsUrl, gapMs);
        // RFC 9309: a 4xx robots.txt means no restrictions; a 5xx means do not crawl yet.
        if (r.status >= 500 || (r.status >= 300 && r.status < 400))
          throw Error(`robots.txt unavailable (HTTP ${r.status})`);
        robotsCache.set(url.origin, {
          at: Date.now(),
          rules: robotsParser(robotsUrl, r.status === 200 ? r.text : ''),
        });
      })().finally(() => robotsLoading.delete(url.origin));
      robotsLoading.set(url.origin, loading);
    }
    await loading;
    cached = robotsCache.get(url.origin)!;
  }
  if (cached.rules.isAllowed(url.href, agent) === false)
    throw Error('robots.txt does not allow this URL');
  const crawlDelay = cached.rules.getCrawlDelay(agent);
  if (crawlDelay && crawlDelay > 60)
    throw Error('Source crawl-delay exceeds this worker run budget');
  // The published crawl-delay is the gap between requests to that host, enforced by the
  // host queue rather than an extra sleep on top of it.
  const result = await rawFetch(
    source,
    url.href,
    Math.max(gapMs, (crawlDelay || 0) * 1000),
  );
  if (result.status < 200 || result.status >= 300)
    throw new SourceHttpError(result.status);
  return result.text;
}
