import assert from 'node:assert/strict';
import { test } from 'node:test';
import { paginationPages } from '../lib/pagination';

void test('first page includes nearby pages, long jumps and the last page', () => {
  assert.deepEqual(paginationPages(1, 405), [
    1, 2, 3, 'gap', 11, 'gap', 51, 'gap', 405,
  ]);
});

void test('page 200 of 405 includes both directions of every jump', () => {
  assert.deepEqual(paginationPages(200, 405), [
    1, 'gap', 150, 'gap', 190, 'gap', 198, 199, 200, 201, 202,
    'gap', 210, 'gap', 250, 'gap', 405,
  ]);
});

void test('last page omits candidates beyond the end', () => {
  assert.deepEqual(paginationPages(405, 405), [
    1, 'gap', 355, 'gap', 395, 'gap', 403, 404, 405,
  ]);
});

void test('two pages have no duplicates or gaps', () => {
  assert.deepEqual(paginationPages(1, 2), [1, 2]);
  assert.deepEqual(paginationPages(2, 2), [1, 2]);
});

void test('a single page or empty result needs no pagination', () => {
  assert.deepEqual(paginationPages(1, 1), []);
  assert.deepEqual(paginationPages(1, 0), []);
});

void test('current beyond total still returns only valid destinations', () => {
  assert.deepEqual(paginationPages(406, 405), [
    1, 'gap', 356, 'gap', 396, 'gap', 404, 405,
  ]);
  assert.deepEqual(paginationPages(500, 405), [1, 'gap', 405]);
});
