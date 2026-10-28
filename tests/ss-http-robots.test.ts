import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceFetch, SourceHttpError } from '../worker/http';
void test('SS JSON fallback honors robots.txt before requesting a data URL', async (t) => {
  const requested: string[] = [];
  t.mock.method(globalThis, 'fetch', async (input: URL) => {
    const url = new URL(input);
    requested.push(url.pathname);
    if (url.pathname === '/robots.txt')
      return new Response('User-agent: *\nAllow: /\nDisallow: /_next/data/');
    if (url.pathname === '/ka')
      return new Response(
        '<script id="__NEXT_DATA__">{"buildId":"robots-build"}</script>',
      );
    return new Response('blocked', { status: 403 });
  });
  await assert.rejects(
    () => sourceFetch('ss', 'https://jobs.ss.ge/ka/l/vacancies?page=1'),
    (e: unknown) => e instanceof SourceHttpError && e.status === 403,
  );
  assert.deepEqual(requested, ['/robots.txt', '/ka/l/vacancies', '/ka']);
});
