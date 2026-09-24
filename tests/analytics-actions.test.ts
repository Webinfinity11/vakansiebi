import test from 'node:test';
import assert from 'node:assert/strict';
import { actionGroups, groupActions } from '../lib/analytics-actions';

void test('every known code is listed, busiest first, and the relax offers join the list group', () => {
  const groups = groupActions(
    [
      { value: 'more_click', count: 3 },
      { value: 'open_list', count: 9 },
      { value: 'relax_city', count: 2 },
      { value: 'share_copy', count: 1 },
    ],
    (filter) => `მოხსნა: ${filter}`,
  );
  assert.equal(groups.length, actionGroups.length);
  const list = groups[0];
  assert.deepEqual(
    list.rows.slice(0, 3).map((row) => [row.code, row.count]),
    [
      ['open_list', 9],
      ['more_click', 3],
      ['relax_city', 2],
    ],
  );
  assert.equal(
    list.rows.find((row) => row.code === 'relax_city')?.label,
    'მოხსნა: city',
  );
  assert.equal(list.total, 14);
  assert.ok(
    list.rows.some((row) => row.code === 'page_prev' && row.count === 0),
  );
  assert.equal(groups[2].total, 1);
});

void test('a code the admin does not know yet is shown by name in a last group', () => {
  const groups = groupActions([{ value: 'brand_new', count: 4 }], String);
  const last = groups.at(-1)!;
  assert.equal(last.title, 'სხვა');
  assert.deepEqual(last.rows, [
    { code: 'brand_new', label: 'brand_new', count: 4 },
  ]);
});
