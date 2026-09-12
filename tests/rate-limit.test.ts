import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clientKey,
  rateLimit,
  resetConcurrency,
  resetRateLimits,
  withLimitedConcurrency,
} from '../lib/server/rate-limit';

void test('a client is allowed up to the limit and refused after it', () => {
  resetRateLimits();
  const at = 1_000_000;
  for (let hit = 1; hit <= 3; hit += 1)
    assert.equal(
      rateLimit('a', { limit: 3, windowMs: 1000, now: at }).allowed,
      true,
      `hit ${hit} should pass`,
    );
  const refused = rateLimit('a', { limit: 3, windowMs: 1000, now: at });
  assert.equal(refused.allowed, false);
  assert.ok(refused.retryAfterSeconds >= 1);
  // One noisy client does not spend another's allowance.
  assert.equal(
    rateLimit('b', { limit: 3, windowMs: 1000, now: at }).allowed,
    true,
  );
});

void test('the window is forgotten once it has passed', () => {
  resetRateLimits();
  const at = 2_000_000;
  rateLimit('a', { limit: 1, windowMs: 1000, now: at });
  assert.equal(
    rateLimit('a', { limit: 1, windowMs: 1000, now: at + 999 }).allowed,
    false,
  );
  assert.equal(
    rateLimit('a', { limit: 1, windowMs: 1000, now: at + 1000 }).allowed,
    true,
  );
});

void test('the retry hint counts down inside one window', () => {
  resetRateLimits();
  const at = 3_000_000;
  rateLimit('a', { limit: 1, windowMs: 10_000, now: at });
  const early = rateLimit('a', { limit: 1, windowMs: 10_000, now: at + 1_000 });
  const late = rateLimit('a', { limit: 1, windowMs: 10_000, now: at + 9_000 });
  assert.equal(early.retryAfterSeconds, 9);
  assert.equal(late.retryAfterSeconds, 1);
});

void test('a stream of distinct clients cannot grow the table without end', () => {
  resetRateLimits();
  const at = 4_000_000;
  for (let i = 0; i < 5200; i += 1)
    rateLimit('client-' + i, { limit: 1, windowMs: 60_000, now: at });
  // The earliest keys were evicted, so their allowance is fresh again rather than leaked.
  assert.equal(
    rateLimit('client-0', { limit: 1, windowMs: 60_000, now: at }).allowed,
    true,
  );
  // A key written at the end of the stream still holds its count.
  assert.equal(
    rateLimit('client-5199', { limit: 1, windowMs: 60_000, now: at }).allowed,
    false,
  );
});

void test('the client key prefers the forwarded address and never escapes the limit', () => {
  assert.equal(
    clientKey(
      new Request('https://example.com', {
        headers: { 'x-forwarded-for': '203.0.113.7, 70.41.3.18' },
      }),
    ),
    '203.0.113.7',
  );
  assert.equal(
    clientKey(
      new Request('https://example.com', {
        headers: { 'x-real-ip': '198.51.100.9' },
      }),
    ),
    '198.51.100.9',
  );
  assert.equal(clientKey(new Request('https://example.com')), 'unknown');
});

void test('only so many of one kind of query may be in the database at once', async () => {
  resetConcurrency();
  let release: (() => void) | null = null;
  const held = new Promise<string>((resolve) => {
    release = () => resolve('done');
  });
  const first = withLimitedConcurrency('probe', 2, () => held);
  const second = withLimitedConcurrency('probe', 2, () => held);
  assert.ok(first && second, 'the first two run');
  // A third arrives while both are still in the database and is refused rather than queued.
  assert.equal(
    withLimitedConcurrency('probe', 2, () => held),
    null,
  );
  // A different kind of query keeps its own ceiling.
  const other = withLimitedConcurrency('elsewhere', 2, async () => 'ok');
  assert.ok(other);
  await other;
  release!();
  await Promise.all([first, second]);
  // Once they finish the slots are free again, including after a failure.
  const failing = withLimitedConcurrency('probe', 2, () =>
    Promise.reject(new Error('database said no')),
  );
  assert.ok(failing);
  await assert.rejects(failing, /database said no/);
  const afterFailure = withLimitedConcurrency('probe', 2, async () => 'ok');
  assert.ok(afterFailure, 'a failed query must not hold its slot');
  assert.equal(await afterFailure, 'ok');
});
