import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateVacancyAnalytics,
  vacancyEventKinds,
} from '../lib/vacancy-analytics';

void test('vacancy counts combine raw and daily rows without mixing vacancies or kinds', () => {
  const result = aggregateVacancyAnalytics(
    ['a', 'b'],
    [
      { value: 'a', kind: 'view', total: '5', last7: '2' },
      { value: 'a', kind: 'view', total: '11', last7: '0' },
      { value: 'b', kind: 'view', total: '3', last7: '1' },
      ...vacancyEventKinds
        .filter((kind) => kind !== 'view')
        .map((kind) => ({ value: 'a', kind, total: 4, last7: 1 })),
      { value: 'unrequested', kind: 'view', total: 99, last7: 99 },
    ],
  );
  assert.equal(result.a.total.view, 16);
  assert.equal(result.a.last7.view, 2);
  assert.equal(result.b.total.view, 3);
  for (const kind of vacancyEventKinds.filter((kind) => kind !== 'view')) {
    assert.equal(result.a.total[kind], 4);
    assert.equal(result.a.last7[kind], 1);
    assert.equal(result.b.total[kind], 0);
  }
  assert.equal(result.unrequested, undefined);
});

void test('empty vacancies have independent zero counts and empty requests stay empty', () => {
  assert.deepEqual(aggregateVacancyAnalytics([], []), {});
  const result = aggregateVacancyAnalytics(['new', 'other'], []);
  for (const counts of Object.values(result)) {
    assert.deepEqual(Object.values(counts.total), [0, 0, 0, 0, 0, 0]);
    assert.deepEqual(Object.values(counts.last7), [0, 0, 0, 0, 0, 0]);
  }
  result.new.total.view = 1;
  assert.equal(result.other.total.view, 0);
  assert.equal(result.new.last7.view, 0);
});
