import robotsParser from 'robots-parser';
import { hostTurn } from './http';
const agent = 'ErtadVacancyBot/0.1';
const robots = new Map<string, ReturnType<typeof robotsParser>>();
export const linkedHosts = [
  'hel-ai.com',
  'app.helio-ai.com',
  'www.app.helio-ai.com',
  'api.helio-ai.com',
  'smrtr.io',
  'jobs.smartrecruiters.com',
  'careers.smartrecruiters.com',
  'wrk.ge',
  'flow.awork.ge',
  'awork.ge',
  'www.awork.ge',
  'www.libertybank.ge',
  'libertybank.ge',
  'jsc-bank-of-georgia.hirehive.com',
  'betlivecom.hirehive.com',
  'jsc-georgian-card.hirehive.com',
  'tp-georgia.softgarden.io',
];
/** A definite employer response code; 4xx means this link will not become readable by retrying. */
export class EmployerHttpError extends Error {
  constructor(
    public status: number,
    message = `Employer returned HTTP ${status}`,
  ) {
    super(message);
  }
}
/** The linked page is reachable but is not usable as this vacancy's text; retrying cannot change that. */
export class UnusableEmployerLink extends Error {}
export function validateLinkedUrl(value: string) {
  const u = new URL(value);
  if (
    u.protocol !== 'https:' ||
    u.username ||
    u.password ||
    u.port ||
    !(
      linkedHosts.includes(u.hostname) ||
      /^[a-z0-9-]+\.selfrecruit\.ge$/.test(u.hostname)
    )
  )
    throw new UnusableEmployerLink('Unsupported employer URL');
  return u;
}
async function request(url: URL, gapMs = 1000) {
  // Details are fetched by several workers at once; the shared host queue keeps requests to
  // one employer host a second apart instead of letting them overlap.
  await hostTurn(url.hostname, gapMs);
  const r = await fetch(url, {
    redirect: 'manual',
    signal: AbortSignal.timeout(25000),
    headers: {
      'User-Agent': agent,
      Accept: 'text/html,application/json,text/plain',
    },
  });
  if (Number(r.headers.get('content-length')) > 6000000) {
    await r.body?.cancel();
    throw new UnusableEmployerLink('Employer response too large');
  }
  const reader = r.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (reader)
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 6000000) {
        await reader.cancel();
        throw new UnusableEmployerLink('Employer response too large');
      }
      chunks.push(value);
    }
  return {
    status: r.status,
    location: r.headers.get('location'),
    text: Buffer.concat(chunks).toString('utf8'),
  };
}
export async function publicPage(
  value: string,
  redirects = 0,
): Promise<{ url: string; text: string }> {
  const u = validateLinkedUrl(value);
  if (redirects > 5)
    throw new UnusableEmployerLink('Too many employer redirects');
  let rules = robots.get(u.origin);
  if (!rules) {
    const robotUrl = new URL('/robots.txt', u);
    let target = robotUrl;
    let r = await request(target);
    for (
      let hop = 0;
      r.status >= 300 && r.status < 400 && r.location && hop < 5;
      hop++
    ) {
      target = validateLinkedUrl(new URL(r.location, target).href);
      r = await request(target);
    }
    if (![200, 404, 410].includes(r.status))
      throw new EmployerHttpError(
        r.status,
        `Employer robots unavailable (${r.status})`,
      );
    rules = robotsParser(robotUrl.href, r.status === 200 ? r.text : '');
    robots.set(u.origin, rules);
  }
  if (rules.isAllowed(u.href, agent) === false)
    throw new UnusableEmployerLink('Employer robots disallow vacancy');
  const crawlDelay = rules.getCrawlDelay(agent) || 0;
  if (crawlDelay > 60)
    throw new UnusableEmployerLink('Employer crawl delay exceeds budget');
  // The employer's published crawl-delay becomes the gap between requests to that host.
  const r = await request(u, Math.max(1000, crawlDelay * 1000));
  if (r.status >= 300 && r.status < 400 && r.location)
    return publicPage(new URL(r.location, u).href, redirects + 1);
  if (r.status < 200 || r.status >= 300) throw new EmployerHttpError(r.status);
  return { url: u.href, text: r.text };
}
