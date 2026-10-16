import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readSavedVacancies,
  updateSavedVacancies,
} from '../lib/saved-vacancies';

const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
function storage(initial = '[]') {
  let value = initial;
  return {
    getItem: () => value,
    setItem: (_key: string, next: string) => {
      value = next;
    },
  };
}

void test('saving at capacity preserves all existing bookmarks instead of evicting the oldest', () => {
  const ids = Array.from({ length: 100 }, (_, i) => id(i));
  const saved = storage(JSON.stringify(ids));
  assert.equal(updateSavedVacancies(saved, id(101)).limited, true);
  assert.deepEqual(readSavedVacancies(saved), ids);
  updateSavedVacancies(saved, id(0), false);
  assert.equal(updateSavedVacancies(saved, id(101)).limited, false);
  assert.equal(readSavedVacancies(saved).length, 100);
});

void test('fresh reads and explicit undo preserve changes made by another view', () => {
  const saved = storage();
  updateSavedVacancies(saved, id(1));
  updateSavedVacancies(saved, id(2));
  updateSavedVacancies(saved, id(1), false);
  assert.deepEqual(readSavedVacancies(saved), [id(2)]);
  updateSavedVacancies(saved, id(1), true);
  assert.deepEqual(readSavedVacancies(saved), [id(2), id(1)]);
});

void test('unreadable storage and quota failures do not destroy the saved value', () => {
  for (const invalid of ['{broken', '{"recoverable":"data"}']) {
    const saved = storage(invalid);
    assert.throws(() => updateSavedVacancies(saved, id(1)));
    assert.equal(saved.getItem(), invalid);
  }
  const saved = storage(JSON.stringify([id(1)]));
  assert.throws(() =>
    updateSavedVacancies(
      {
        ...saved,
        setItem: () => {
          throw Error('Quota exceeded');
        },
      },
      id(2),
    ),
  );
  assert.deepEqual(readSavedVacancies(saved), [id(1)]);
});
