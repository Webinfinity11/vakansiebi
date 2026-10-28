import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  sourceFetch,
  SourceHttpError,
  takeSourceHttpDiagnostic,
} from '../worker/http';
import { listLinks, parseDetail } from '../worker/adapters';
const fixture = (name: string) =>
  readFileSync(`tests/fixtures/ss-next/${name}`, 'utf8');
void test('HTTP 403 uses SS JSON for listings/details and failed JSON never becomes a removal', async (t) => {
  const listing =
    'https://jobs.ss.ge/ka/l/vacancies?sortBy=OrderDate_desc&page=2';
  const detail = 'https://jobs.ss.ge/ka/details/dizaineri-123';
  const requested: string[] = [];
  let mode = 'ok';
  t.mock.method(globalThis, 'fetch', async (input: URL) => {
    const url = new URL(input);
    requested.push(url.href);
    if (url.pathname === '/robots.txt')
      return new Response('User-agent: *\nAllow: /');
    if (url.pathname === '/ka') return new Response(fixture('bootstrap.html'));
    if (url.pathname.startsWith('/_next/data/'))
      return mode === 'ok'
        ? new Response(
            fixture(
              url.pathname.includes('/details/')
                ? 'detail.json'
                : 'listing.json',
            ),
            { headers: { 'content-type': 'application/json' } },
          )
        : new Response('', { status: 404 });
    return new Response(fixture('challenge.html'), {
      status: 403,
      headers: { server: 'cloudflare', 'cf-mitigated': 'challenge' },
    });
  });
  const html = await sourceFetch('ss', listing);
  assert.equal(listLinks('ss', html, listing).length, 2);
  assert.ok(
    requested.some((u) =>
      u.endsWith('/ka/l/vacancies.json?sortBy=OrderDate_desc&page=2'),
    ),
  );
  assert.equal(
    parseDetail('ss', await sourceFetch('ss', detail), detail).title,
    'დიზაინერი',
  );
  assert.match(takeSourceHttpDiagnostic('ss')!, /cf-mitigated.*challenge/);
  mode = 'stale';
  await assert.rejects(
    () => sourceFetch('ss', detail),
    (e: unknown) =>
      e instanceof SourceHttpError &&
      e.status === 403 &&
      e.message.includes('cloudflare'),
  );
  assert.ok(requested.every((u) => new URL(u).hostname === 'jobs.ss.ge'));
});
