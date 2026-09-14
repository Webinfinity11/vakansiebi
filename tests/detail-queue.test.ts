import test from 'node:test';
import assert from 'node:assert/strict';
import { detailQueue } from '../worker/detail-queue';

void test('a jobs.ge run ending before its new-item quota still rechecks old vacancies', () => {
  const pending = Array.from({ length: 540 }, (_, i) => `new:${i}`);
  const existing = Array.from({ length: 60 }, (_, i) => `old:${i}`);
  const queue = detailQueue(pending, existing);
  // Production recently processed 184 records before its 22-minute budget expired.
  const processed = queue.slice(0, 184);
  assert.equal(processed.filter((id) => id.startsWith('old:')).length, 18);
  assert.equal(processed.filter((id) => id.startsWith('new:')).length, 166);
  assert.equal(new Set(queue).size, 600);
  assert.deepEqual(queue.filter((id) => id.startsWith('new:')), pending);
  assert.deepEqual(queue.filter((id) => id.startsWith('old:')), existing);
});

void test('short and empty queues use all available work without duplicates', () => {
  assert.deepEqual(detailQueue([], []), []);
  assert.deepEqual(detailQueue([1, 2], []), [1, 2]);
  assert.deepEqual(detailQueue([], [3, 4]), [3, 4]);
  assert.deepEqual(detailQueue([1], [3, 4]), [1, 3, 4]);
  assert.deepEqual(detailQueue([1, 2, 3, 4], [5]), [1, 2, 3, 4, 5]);
});
