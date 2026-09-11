import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatchScraper } from '../lib/server/scraper-github';
void test('GitHub dispatch is pinned to this workflow and main, never sends credentials to redirects', async (t) => {
  const before = process.env.GITHUB_ACTIONS_TOKEN;
  process.env.GITHUB_ACTIONS_TOKEN = 'fixture-token';
  let calls = 0;
  const fetch = t.mock.method(
    globalThis,
    'fetch',
    async (url: RequestInfo | URL, init?: RequestInit) => {
      calls++;
      assert.equal(
        url,
        'https://api.github.com/repos/Webinfinity11/vakansiebi/actions/workflows/scrape.yml/dispatches',
      );
      assert.equal(init?.redirect, 'error');
      assert.deepEqual(JSON.parse(init?.body as string), { ref: 'main' });
      return new Response('{}', { status: 200 });
    },
  );
  try {
    assert.deepEqual(await dispatchScraper(), { dispatched: true });
    delete process.env.GITHUB_ACTIONS_TOKEN;
    assert.deepEqual(await dispatchScraper(), {
      dispatched: false,
      reason: 'not_configured',
    });
    assert.equal(calls, 1);
    process.env.GITHUB_ACTIONS_TOKEN = 'fixture-token';
    fetch.mock.mockImplementation(
      async () => new Response('private error response', { status: 403 }),
    );
    assert.deepEqual(await dispatchScraper(), {
      dispatched: false,
      reason: 'github_rejected',
    });
    fetch.mock.mockImplementation(async () => {
      throw Error('private transport error');
    });
    assert.deepEqual(await dispatchScraper(), {
      dispatched: false,
      reason: 'github_unavailable',
    });
  } finally {
    fetch.mock.restore();
    if (before === undefined) delete process.env.GITHUB_ACTIONS_TOKEN;
    else process.env.GITHUB_ACTIONS_TOKEN = before;
  }
});
