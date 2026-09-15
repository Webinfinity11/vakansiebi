import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cacheHeader,
  createPublicJobsCache,
  publicJobsCacheKey,
} from '../lib/server/jobs-cache';

void test('a list that belongs to one person is never held at the edge', () => {
  const shared = cacheHeader(new URLSearchParams('page=1&city=ბათუმი'));
  assert.match(shared, /^public, s-maxage=/);
  for (const personal of ['preview=1', 'ids=a,b', 'exclude=a,b'])
    assert.equal(
      cacheHeader(new URLSearchParams(personal)),
      'private, no-store',
      personal,
    );
});

void test('response cache normalizes filters and keeps response shapes and personal scopes separate', () => {
  const key = (value: string) => publicJobsCacheKey(new URLSearchParams(value));
  assert.equal(
    key('summary=1&page=01&paid=true&q= cashier '),
    key('q=cashier&paid=true&summary=1'),
  );
  assert.equal(key('page=0&unused=anything'), key(''));
  assert.equal(key('countsOnly=1&page=9'), key('countsOnly=1'));
  for (const value of [
    'page=2',
    'summary=1',
    'countsOnly=1',
    'q=cashier',
    'sort=salary',
    'remote=true',
  ])
    assert.notEqual(key(value), key(''), value);
  for (const value of [
    'preview=1',
    'preview=0',
    'ids=',
    'exclude=',
    'exclude=a,b',
  ])
    assert.equal(key(value), null, value);
  assert.equal(publicJobsCacheKey(new URLSearchParams(), true), null);
  assert.equal(publicJobsCacheKey(new URLSearchParams(), false, ['a']), null);
});

void test('response cache coalesces misses, expires after 45 seconds and isolates returned objects', async () => {
  let now = 1000,
    calls = 0;
  const cache = createPublicJobsCache<{ jobs: { id: string }[] }>(() => now);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const load = async () => {
    calls++;
    await gate;
    return { jobs: [{ id: 'original' }] };
  };
  const a = cache.get('same', load),
    b = cache.get('same', load);
  await Promise.resolve();
  assert.equal(calls, 1);
  release();
  const [first, second] = await Promise.all([a, b]);
  first.jobs[0].id = 'changed';
  assert.equal(second.jobs[0].id, 'original');
  now += 44_999;
  assert.equal((await cache.get('same', load)).jobs[0].id, 'original');
  assert.equal(calls, 1);
  now++;
  await cache.get('same', load);
  assert.equal(calls, 2);
  cache.clear();
  await cache.get('same', load);
  assert.equal(calls, 3);
});

void test('response cache retains at most 200 entries and refreshes recently used entries', async () => {
  const cache = createPublicJobsCache<number>();
  const calls = new Map<number, number>();
  const get = (id: number) =>
    cache.get(String(id), async () => {
      calls.set(id, (calls.get(id) || 0) + 1);
      return id;
    });
  for (let i = 0; i < 200; i++) await get(i);
  await get(0);
  await get(200);
  await get(0);
  await get(1);
  assert.equal(calls.get(0), 1);
  assert.equal(calls.get(1), 2);
});

void test('failed and private responses are never cached', async () => {
  const cache = createPublicJobsCache<number>();
  let calls = 0;
  const fail = async () => {
    calls++;
    throw new Error('database unavailable');
  };
  await Promise.all([
    assert.rejects(cache.get('key', fail), /database unavailable/),
    assert.rejects(cache.get('key', fail), /database unavailable/),
  ]);
  assert.equal(calls, 1);
  assert.equal(
    await cache.get('key', async () => {
      calls++;
      return 42;
    }),
    42,
  );
  assert.equal(calls, 2);
  await Promise.all([
    cache.get(null, async () => ++calls),
    cache.get(null, async () => ++calls),
  ]);
  assert.equal(calls, 4);
});

void test('summary and draft counts retain the same personal cache boundary', () => {
  for (const shape of ['summary=1&page=1', 'countsOnly=1&remote=true']) {
    assert.match(
      cacheHeader(new URLSearchParams(shape)),
      /^public, s-maxage=60,/,
    );
    for (const personal of ['preview=1', 'ids=', 'exclude=', 'exclude=a,b'])
      assert.equal(
        cacheHeader(new URLSearchParams(`${shape}&${personal}`)),
        'private, no-store',
        `${shape}&${personal}`,
      );
  }
});
