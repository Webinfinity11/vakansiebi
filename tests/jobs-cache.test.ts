import test from 'node:test';
import assert from 'node:assert/strict';
import { cacheHeader } from '../lib/server/jobs-cache';

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
