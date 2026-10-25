import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchPublicJson,
  isJobsPage,
  isSimilarJobs,
  loadFailureAction,
  loadFailureMessage,
  PublicLoadError,
} from '../lib/public-load';

const page = { jobs: [], total: 0, pages: 0, search: {} };
const options = () => ({
  signal: new AbortController().signal,
  valid: isJobsPage,
});
const reason = (expected: string) => (error: unknown) =>
  error instanceof PublicLoadError && error.reason === expected;

void test('valid responses arrive once and malformed success responses become readable errors', async (t) => {
  const mock = t.mock.method(globalThis, 'fetch', async () =>
    Response.json(page),
  );
  assert.deepEqual(await fetchPublicJson('/api/jobs', options()), page);
  for (const body of [
    {},
    { ...page, jobs: [null] },
    { ...page, total: -1 },
    { ...page, search: null },
  ]) {
    mock.mock.mockImplementation(async () => Response.json(body));
    await assert.rejects(
      fetchPublicJson('/api/jobs', options()),
      reason('response'),
    );
  }
  mock.mock.mockImplementation(
    async () => new Response('<html>unavailable</html>'),
  );
  await assert.rejects(
    fetchPublicJson('/api/jobs', options()),
    reason('response'),
  );
  assert.ok(
    !loadFailureMessage(new SyntaxError('private response')).includes(
      'private',
    ),
  );
  assert.equal(
    isSimilarJobs({
      jobs: [
        {
          job: { id: 'one', title: 'Developer' },
          reasons: ['მსგავსი პოზიცია'],
        },
      ],
    }),
    true,
  );
  assert.equal(isSimilarJobs({ jobs: [{ job: {}, reasons: null }] }), false);
});

void test('HTTP failures are classified without reading or exposing an error body', async (t) => {
  const mock = t.mock.method(globalThis, 'fetch');
  for (const [status, expected] of [
    [400, 'request'],
    [404, 'missing'],
    [429, 'limited'],
    [500, 'server'],
    [503, 'server'],
    [504, 'timeout'],
  ] as const) {
    mock.mock.mockImplementation(
      async () => new Response('private HTML error', { status }),
    );
    await assert.rejects(
      fetchPublicJson('/api/jobs', options()),
      reason(expected),
    );
  }
  mock.mock.mockImplementation(
    async () =>
      new Response('', { status: 503, headers: { 'X-Jobx-Error': 'timeout' } }),
  );
  await assert.rejects(
    fetchPublicJson('/api/jobs', options()),
    reason('timeout'),
  );
  assert.equal(
    mock.mock.callCount(),
    7,
    'a failed request is never automatically retried',
  );
});

void test('transport failures have a separate bounded analytics code', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => {
    throw new TypeError('Failed to fetch secret query');
  });
  await assert.rejects(
    fetchPublicJson('/api/jobs?q=private', options()),
    reason('network'),
  );
  const code = loadFailureAction('results', new PublicLoadError('network'));
  assert.equal(code, 'results_network');
  assert.ok(code.length <= 24);
});

void test('a deadline aborts the request and is different from changing the filter', async (t) => {
  t.mock.method(
    globalThis,
    'fetch',
    (_url: Parameters<typeof fetch>[0], init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init!.signal!.addEventListener(
          'abort',
          () => reject(new DOMException('Aborted', 'AbortError')),
          { once: true },
        );
      }),
  );
  await assert.rejects(
    fetchPublicJson('/api/jobs', { ...options(), timeoutMs: 5 }),
    reason('timeout'),
  );
  const controller = new AbortController();
  const pending = fetchPublicJson('/api/jobs', {
    signal: controller.signal,
    valid: isJobsPage,
  });
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
});

void test('cancellation wins over a late non-Abort error from a superseded request', async (t) => {
  const controller = new AbortController();
  t.mock.method(globalThis, 'fetch', async () => {
    controller.abort();
    throw new TypeError('old failure');
  });
  await assert.rejects(
    fetchPublicJson('/api/jobs', {
      signal: controller.signal,
      valid: isJobsPage,
    }),
    { name: 'AbortError' },
  );
});

void test('the deadline covers body reading, and an already cancelled request does no work', async (t) => {
  const mock = t.mock.method(
    globalThis,
    'fetch',
    async (_url: Parameters<typeof fetch>[0], init?: RequestInit) =>
      ({
        ok: true,
        json: () =>
          new Promise((_resolve, reject) =>
            init!.signal!.addEventListener(
              'abort',
              () => reject(new DOMException('Aborted', 'AbortError')),
              { once: true },
            ),
          ),
      }) as Response,
  );
  await assert.rejects(
    fetchPublicJson('/api/jobs', { ...options(), timeoutMs: 5 }),
    reason('timeout'),
  );
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    fetchPublicJson('/api/jobs', {
      signal: controller.signal,
      valid: isJobsPage,
    }),
    { name: 'AbortError' },
  );
  assert.equal(mock.mock.callCount(), 1);
});
