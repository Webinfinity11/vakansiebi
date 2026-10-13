import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import { proxy, config } from '../proxy';
import {
  limitPublicRead,
  publicReadPolicy,
} from '../lib/server/public-read-limit';
import { resetRateLimits } from '../lib/server/rate-limit';

const names = [
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'VERCEL',
] as const;
const original = names.map((name) => process.env[name]);
const originalFetch = globalThis.fetch;
beforeEach(() => {
  resetRateLimits();
  for (const name of names) delete process.env[name];
});
afterEach(() => {
  names.forEach((name, i) => {
    if (original[i] === undefined) delete process.env[name];
    else process.env[name] = original[i];
  });
  globalThis.fetch = originalFetch;
});
const request = (path: string, ip = '203.0.113.7', headers = {}) =>
  new NextRequest(`https://jobx.ge${path}`, {
    headers: { 'x-forwarded-for': ip, ...headers },
  });

void test('API query parameters are not subject to legacy page redirects', async () => {
  const response = await proxy(request('/api/jobs?from=external'));
  assert.equal(response.headers.get('location'), null);
});

void test('all protected routes pass through Proxy; unrelated operations are excluded', () => {
  for (const path of [
    '/',
    '/vacancies/abc',
    '/companies/acme',
    '/api/jobs',
    '/api/jobs/a/similar',
    '/api/map',
    '/api/catalogue',
    '/api/company-links',
    '/api/suggest',
  ]) {
    assert.ok(publicReadPolicy(path));
    assert.equal(
      unstable_doesMiddlewareMatch({
        config,
        nextConfig: {},
        url: `https://jobx.ge${path}`,
      }),
      true,
    );
  }
  for (const path of [
    '/api/admin/jobs',
    '/api/cron/invoice-email',
    '/api/events',
    '/api/logos/abc',
    '/sitemap.xml',
    '/robots.txt',
    '/vacancies/a/opengraph-image',
  ])
    assert.equal(publicReadPolicy(path), null, path);
});

void test('map requests are refused before handler work, without caching the refusal', async () => {
  for (let i = 0; i < 6; i++)
    assert.equal(await limitPublicRead(request('/api/map')), null);
  const denied = await proxy(
    request('/api/map?cache-buster=1', '203.0.113.7', {
      'user-agent': 'Googlebot',
      'next-router-prefetch': '1',
    }),
  );
  assert.equal(denied.status, 429);
  assert.equal(denied.headers.get('Cache-Control'), 'private, no-store');
  assert.ok(Number(denied.headers.get('Retry-After')) > 0);
  assert.equal(await limitPublicRead(request('/api/map', '203.0.113.8')), null);
});

void test('rotating endpoints and filters shares the API budget; HEAD is counted', async () => {
  for (let i = 0; i < 120; i++)
    assert.equal(
      await limitPublicRead(
        request(i % 2 ? '/api/jobs?page=' + i : '/api/catalogue'),
      ),
      null,
    );
  const head = new Request(request('/api/jobs'), { method: 'HEAD' });
  assert.equal((await limitPublicRead(head))?.status, 429);
  assert.equal(
    await limitPublicRead(
      new Request(request('/api/jobs'), { method: 'POST' }),
    ),
    null,
  );
});

void test('IPv6 rotations in one /64 share a budget', async () => {
  for (let i = 0; i < 6; i++)
    assert.equal(
      await limitPublicRead(request('/api/map', `2001:db8:abcd:1::${i + 1}`)),
      null,
    );
  assert.equal(
    (await limitPublicRead(request('/api/map', '2001:0db8:abcd:0001::ff')))
      ?.status,
    429,
  );
});

void test('shared store keys survive instance resets and use the Vercel address', async () => {
  process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
  process.env.VERCEL = '1';
  const commands: unknown[][] = [];
  globalThis.fetch = async (_url, init) => {
    assert.equal(typeof init?.body, 'string');
    commands.push(JSON.parse(init?.body as string));
    return Response.json({ result: commands.length === 1 ? 0 : 1200 });
  };
  assert.equal(
    await limitPublicRead(
      request('/api/jobs', '1.1.1.1', {
        'x-vercel-forwarded-for': '203.0.113.9',
      }),
    ),
    null,
  );
  resetRateLimits();
  const denied = await limitPublicRead(
    request('/api/jobs?page=2', '2.2.2.2', {
      'x-vercel-forwarded-for': '203.0.113.9',
    }),
  );
  assert.equal(denied?.status, 429);
  assert.equal(denied?.headers.get('Retry-After'), '2');
  assert.deepEqual(commands[0], commands[1]);
  assert.equal(commands[0][0], 'EVAL');
  assert.equal(JSON.stringify(commands).includes('203.0.113.9'), false);
});

void test('configured store failures and partial configuration do not open access', async (t) => {
  t.mock.method(console, 'error', () => {});
  process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example';
  assert.equal((await limitPublicRead(request('/api/jobs')))?.status, 503);
  process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
  for (const reply of [{ error: 'failed' }, { result: '0' }, { result: -1 }]) {
    globalThis.fetch = async () => Response.json(reply);
    assert.equal((await limitPublicRead(request('/api/jobs')))?.status, 503);
  }
  globalThis.fetch = async () => {
    throw new Error('offline');
  };
  assert.equal((await limitPublicRead(request('/api/jobs')))?.status, 503);
  assert.equal(await limitPublicRead(request('/api/admin/jobs')), null);
});

void test('hour quota stops sustained reads and expires without extending a ban', async (t) => {
  let now = 1_000_000;
  t.mock.method(Date, 'now', () => now);
  for (let minute = 0; minute < 10; minute++) {
    for (let hit = 0; hit < 6; hit++)
      assert.equal(await limitPublicRead(request('/api/map')), null);
    now += 60000;
  }
  const denied = await limitPublicRead(request('/api/map'));
  assert.equal(denied?.status, 429);
  assert.equal(denied?.headers.get('Retry-After'), '3000');
  now = 1_000_000 + 3600000;
  assert.equal(await limitPublicRead(request('/api/map')), null);
});
