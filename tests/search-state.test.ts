import test from 'node:test';
import assert from 'node:assert/strict';
import { readSearch, searchParams } from '../lib/search-state';
void test('a shared search restores all supported filters without private or preview data', () => {
  const filters = {
    query: '  ოფისის მენეჯერი  ',
    city: 'თბილისი',
    category: 'ადმინისტრაცია',
    source: 'jobs.ge',
    paid: true,
    remote: true,
    sort: 'მაღალი ხელფასი',
  };
  const params = searchParams(filters);
  assert.deepEqual(readSearch(params), {
    ...filters,
    query: filters.query.trim(),
  });
  assert.equal(params.has('preview'), false);
  assert.equal(params.has('ids'), false);
});
void test('unknown categories, sources and sort values cannot create misleading selected filters', () => {
  const parsed = readSearch(
    new URLSearchParams(
      'category=fake&source=samushao.ge&sort=invalid&paid=yes',
    ),
  );
  assert.equal(parsed.category, 'ყველა');
  assert.equal(parsed.source, 'ყველა');
  assert.equal(parsed.sort, 'შესაბამისობა');
  assert.equal(parsed.paid, false);
});
