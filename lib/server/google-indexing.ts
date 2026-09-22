import { createHash, createSign } from 'node:crypto';
import { load } from 'cheerio';
import type { Pool } from 'pg';
import { db } from './db';
import { siteUrl, vacancyUrl } from '../seo';
import { vacancyIdFrom } from '../vacancy-navigation';

const tokenUrl = 'https://oauth2.googleapis.com/token';
const publishUrl =
  'https://indexing.googleapis.com/v3/urlNotifications:publish';
export type IndexingNotification = {
  url: string;
  type: 'URL_UPDATED' | 'URL_DELETED';
};
type Snapshot = { status: string; published: { title?: string } | null };

// Only transitions, never an inventory/backfill or an unchanged reconciliation.
export function indexingTransition(
  id: string,
  before: Snapshot,
  after: Snapshot,
): IndexingNotification[] {
  if (
    before.status !== 'published' &&
    after.status === 'published' &&
    after.published
  )
    return [
      {
        url: vacancyUrl({ id, title: after.published.title }),
        type: 'URL_UPDATED',
      },
    ];
  if (
    before.status === 'published' &&
    after.status === 'archived' &&
    before.published
  )
    return [
      {
        url: vacancyUrl({ id, title: before.published.title }),
        type: 'URL_DELETED',
      },
    ];
  return [];
}

export function indexingDailyLimit(value?: string): number {
  if (!value?.trim()) return 200;
  const limit = Number(value);
  return Number.isSafeInteger(limit) && limit >= 0 && limit <= 2147483647
    ? limit
    : 200;
}

// One atomic reservation shared by worker processes and the web server. Failed
// publish attempts still consume a slot; refunding an ambiguous timeout is unsafe.
export async function reserveIndexingBudget(
  limit: number,
  connection: Pick<Pool, 'query'> = db(),
  at?: Date,
): Promise<boolean> {
  if (limit <= 0) return false;
  const result = await connection.query(
    `INSERT INTO google_indexing_daily(day, requests)
     VALUES ((COALESCE($2::timestamptz, now()) AT TIME ZONE 'America/Los_Angeles')::date, 1)
     ON CONFLICT (day) DO UPDATE SET requests=google_indexing_daily.requests+1
     WHERE google_indexing_daily.requests < $1
     RETURNING requests`,
    [limit, at ?? null],
  );
  return result.rows.length === 1;
}

export function indexingJwt(
  clientEmail: string,
  privateKey: string,
  now = Date.now(),
): string {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  const issued = Math.floor(now / 1000);
  const input = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/indexing',
    aud: tokenUrl,
    iat: issued,
    exp: issued + 3600,
  })}`;
  const signer = createSign('RSA-SHA256');
  signer.update(input);
  signer.end();
  return `${input}.${signer.sign(privateKey.replaceAll('\\n', '\n'), 'base64url')}`;
}

export function deletionAllowed(status: number, html: string): boolean {
  if (status === 404 || status === 410) return true;
  if (status !== 200) return false;
  const $ = load(html);
  return $('meta')
    .toArray()
    .some(
      (node) =>
        $(node).attr('name')?.toLowerCase() === 'robots' &&
        /(?:^|[\s,])noindex(?:$|[\s,])/i.test($(node).attr('content') || ''),
    );
}

// Dependencies keep tests offline, without any stored private key or real token.
export function createGoogleIndexing({
  env = () => process.env,
  request = (input, init) => fetch(input, init),
  reserve = reserveIndexingBudget,
  now = Date.now,
  warn = (message: string) => console.warn(message),
}: {
  env?: () => Record<string, string | undefined>;
  request?: typeof fetch;
  reserve?: (limit: number) => Promise<boolean>;
  now?: () => number;
  warn?: (message: string) => void;
} = {}) {
  let cached: { identity: string; token: string; expires: number } | undefined;
  let pending: { identity: string; value: Promise<string> } | undefined;

  async function accessToken(email: string, key: string): Promise<string> {
    const identity = createHash('sha256')
      .update(email)
      .update('\0')
      .update(key)
      .digest('hex');
    if (cached?.identity === identity && cached.expires > now())
      return cached.token;
    if (pending?.identity === identity) return pending.value;
    const value = (async () => {
      const started = now();
      const response = await request(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion: indexingJwt(email, key, started),
        }),
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error('token HTTP failure');
      const data = await response.json();
      if (
        typeof data.access_token !== 'string' ||
        !data.access_token ||
        !Number.isFinite(data.expires_in) ||
        data.expires_in <= 0
      )
        throw new Error('invalid token response');
      cached = {
        identity,
        token: data.access_token,
        expires: started + Math.min(data.expires_in, 3600) * 1000 - 60000,
      };
      return data.access_token as string;
    })();
    pending = { identity, value };
    try {
      return await value;
    } finally {
      if (pending?.value === value) pending = undefined;
    }
  }

  async function publish(
    url: string,
    type: IndexingNotification['type'],
  ): Promise<void> {
    let stage = 'configuration';
    try {
      const settings = env();
      const email = settings.GOOGLE_INDEXING_CLIENT_EMAIL?.trim();
      const key = settings.GOOGLE_INDEXING_PRIVATE_KEY?.trim();
      if (!email || !key) return;
      const limit = indexingDailyLimit(settings.GOOGLE_INDEXING_DAILY_LIMIT);
      if (!limit) return;
      const target = new URL(url);
      const segment = decodeURIComponent(
        target.pathname.slice('/vacancies/'.length),
      );
      if (
        target.origin !== siteUrl ||
        target.search ||
        target.hash ||
        !/^\/vacancies\/[^/]+$/.test(target.pathname) ||
        segment.includes('/') ||
        !vacancyIdFrom(segment)
      )
        return;
      if (type === 'URL_DELETED') {
        stage = 'deletion precondition';
        // Check the actual public page after COMMIT. Redirects and still-live
        // pages do not prove deletion. Next can stream a 200 with robots noindex.
        const page = await request(url, {
          redirect: 'manual',
          signal: AbortSignal.timeout(5000),
        });
        if (page.status >= 400 && page.status !== 404 && page.status !== 410) {
          stage = `deletion precondition HTTP ${page.status}`;
          throw new Error('page HTTP failure');
        }
        if (
          !deletionAllowed(
            page.status,
            page.status === 200 ? await page.text() : '',
          )
        )
          return;
      }
      stage = 'authorization';
      const token = await accessToken(email, key);
      stage = 'daily budget';
      if (!(await reserve(limit))) return;
      stage = 'publish';
      const response = await request(publishUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, type }),
        signal: AbortSignal.timeout(5000),
      });
      if (response.status === 401) cached = undefined;
      if (!response.ok) {
        stage = `publish HTTP ${response.status}`;
        throw new Error('publish HTTP failure');
      }
    } catch {
      // Never log response bodies, JWTs, env values, or crypto errors containing keys.
      warn(`[google-indexing] ${stage} failed; notification skipped`);
    }
  }
  return { publish };
}

export const { publish } = createGoogleIndexing();
export async function publishIndexingNotifications(
  events: readonly IndexingNotification[],
) {
  for (const event of events) await publish(event.url, event.type);
}
