import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sourceFetch,
  SourceHttpError,
  hostTurn,
  sourceDelayMs,
} from '../worker/http';

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

void test('a 4xx robots.txt means no restrictions and the page is fetched', async (t) => {
  const requested: string[] = [];
  const mock = t.mock.method(globalThis, 'fetch', async (url: URL) => {
    requested.push(url.pathname);
    return url.pathname === '/robots.txt'
      ? new Response('forbidden', { status: 401 })
      : new Response('<html>vacancy body</html>', { status: 200 });
  });
  try {
    // A fresh origin: robots.txt answers are cached per origin across tests.
    const text = await sourceFetch('hr', 'https://hr.ge/announcement/125/test');
    assert.equal(text, '<html>vacancy body</html>');
    assert.deepEqual(requested, ['/robots.txt', '/announcement/125/test']);
  } finally {
    mock.mock.restore();
  }
});

void test('a 5xx robots.txt stops the crawl before any page is requested', async (t) => {
  const requested: string[] = [];
  const mock = t.mock.method(globalThis, 'fetch', async (url: URL) => {
    requested.push(url.pathname);
    return new Response('', { status: 503 });
  });
  try {
    await assert.rejects(
      () => sourceFetch('jobs', 'https://www.jobs.ge/ge/?view=jobs&id=1'),
      /robots\.txt unavailable \(HTTP 503\)/,
    );
    assert.deepEqual(requested, ['/robots.txt']);
  } finally {
    mock.mock.restore();
  }
});

void test('one host serves concurrent callers one at a time with the gap between them', async () => {
  const gap = 50;
  const turns: number[] = [];
  await Promise.all(
    [1, 2, 3].map(() =>
      hostTurn('serialised.test', gap).then(() => turns.push(Date.now())),
    ),
  );
  assert.equal(turns.length, 3);
  // Timers may fire a millisecond early; anything close to the gap proves serialisation.
  assert.ok(turns[1] - turns[0] >= gap - 5, `second turn after ${turns[1] - turns[0]}ms`);
  assert.ok(turns[2] - turns[1] >= gap - 5, `third turn after ${turns[2] - turns[1]}ms`);
  // A later caller still waits for the gap since the previous request.
  const before = Date.now();
  await hostTurn('serialised.test', gap);
  assert.ok(Date.now() - before >= gap - 5);
  // Different hosts never wait on each other.
  const started = Date.now();
  await Promise.all([hostTurn('a.test', 500), hostTurn('b.test', 500)]);
  assert.ok(Date.now() - started < 400);
});

void test('crawl delay defaults per source and the override never drops below a second', () => {
  const saved = process.env.CRAWL_DELAY_MS;
  try {
    delete process.env.CRAWL_DELAY_MS;
    for (const source of ['hr', 'jobs', 'ss'] as const)
      assert.equal(sourceDelayMs(source), 1000);
    for (const source of ['hrgov', 'gancxadebebi', 'worknet', 'myjobs'] as const)
      assert.equal(sourceDelayMs(source), 2000);
    process.env.CRAWL_DELAY_MS = '3000';
    assert.equal(sourceDelayMs('hr'), 3000);
    assert.equal(sourceDelayMs('hrgov'), 3000);
    process.env.CRAWL_DELAY_MS = '200';
    assert.equal(sourceDelayMs('hr'), 1000);
    assert.equal(sourceDelayMs('hrgov'), 1000);
    process.env.CRAWL_DELAY_MS = 'soon';
    assert.equal(sourceDelayMs('hrgov'), 2000);
  } finally {
    if (saved === undefined) delete process.env.CRAWL_DELAY_MS;
    else process.env.CRAWL_DELAY_MS = saved;
  }
});
