import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceFetch, SourceHttpError } from '../worker/http';

void test('removed pages retain HTTP status for moderation instead of becoming a parser failure', async (t) => {
  const mock = t.mock.method(globalThis, 'fetch', async (url: URL) => {
    return new Response('', {
      status: url.pathname === '/robots.txt' ? 404 : 410,
    });
  });
  try {
    await assert.rejects(
      () => sourceFetch('hr', 'https://www.hr.ge/announcement/123/test'),
      (error: unknown) =>
        error instanceof SourceHttpError && error.status === 410,
    );
  } finally {
    mock.mock.restore();
  }
});

void test('network errors report a diagnostic code without exposing the underlying error content', async (t) => {
  const mock = t.mock.method(globalThis, 'fetch', async () => {
    throw new TypeError('fetch failed with private context', {
      cause: { code: 'UND_ERR_CONNECT_TIMEOUT' },
    });
  });
  try {
    await assert.rejects(
      () => sourceFetch('hr', 'https://www.hr.ge/announcement/124/test'),
      (error: unknown) =>
        error instanceof Error &&
        error.message === 'Source request failed: UND_ERR_CONNECT_TIMEOUT',
    );
  } finally {
    mock.mock.restore();
  }
});
