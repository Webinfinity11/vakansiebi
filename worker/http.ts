import robotsParser from 'robots-parser';
import { setTimeout as delay } from 'node:timers/promises';
import type { SourceId } from '../lib/types';
import { getSourceConfig } from './adapters';
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
const lastRequest = new Map<string, number>();
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
  redirects = 0,
): Promise<{ status: number; text: string }> {
  const url = validateUrl(source, value);
  if (redirects > 3) throw Error('Too many redirects');
  const elapsed = Date.now() - (lastRequest.get(url.hostname) || 0);
  await delay(
    Math.max(
      0,
      Math.max(1000, Number(process.env.CRAWL_DELAY_MS) || 2000) - elapsed,
    ),
  );
  lastRequest.set(url.hostname, Date.now());
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
        redirects + 1,
      );
    }
    if (Number(r.headers.get('content-length')) > 6000000) {
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
        if (size > 6000000) {
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
export async function sourceFetch(source: SourceId, value: string) {
  const url = validateUrl(source, value);
  let cached = robotsCache.get(url.origin);
  if (!cached || Date.now() - cached.at > 3600000) {
    const robotsUrl = url.origin + '/robots.txt';
    const r = await rawFetch(source, robotsUrl);
    if (
      r.status !== 404 &&
      r.status !== 410 &&
      (r.status < 200 || r.status >= 300)
    )
      throw Error(`robots.txt unavailable (HTTP ${r.status})`);
    cached = {
      at: Date.now(),
      rules: robotsParser(robotsUrl, r.status === 200 ? r.text : ''),
    };
    robotsCache.set(url.origin, cached);
  }
  if (cached.rules.isAllowed(url.href, agent) === false)
    throw Error('robots.txt does not allow this URL');
  const crawlDelay = cached.rules.getCrawlDelay(agent);
  if (crawlDelay && crawlDelay > 0) {
    if (crawlDelay > 60)
      throw Error('Source crawl-delay exceeds this worker run budget');
    await delay(crawlDelay * 1000);
  }
  const result = await rawFetch(source, url.href);
  if (result.status < 200 || result.status >= 300)
    throw new SourceHttpError(result.status);
  return result.text;
}
