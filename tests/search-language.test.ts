import test from 'node:test';
import assert from 'node:assert/strict';
import { searchGroups, suggestSearch } from '../lib/search-language';
import { readSearch, searchParams } from '../lib/search-state';
import { filtersSchema } from '../lib/personal-space';
void test('reviewed role equivalents preserve all query terms and technical punctuation', () => {
  assert.ok(searchGroups('ბუღალტერია')[0].includes('accountant'));
  assert.ok(searchGroups('დეველოპერი')[0].includes('developer'));
  assert.deepEqual(searchGroups('C++ C#'), [['c++'], ['c#']]);
  assert.equal(searchGroups('senior დეველოპერი').length, 2);
  assert.equal(
    searchGroups('ბუღალტრის')[0].length,
    1,
    'do not pretend to provide general Georgian morphology',
  );
});
void test('typo suggestions are bounded, explicit and never rewrite short skills or arbitrary names', () => {
  assert.equal(suggestSearch('develoepr'), 'developer');
  assert.equal(suggestSearch('ბუღალტეირ'), 'ბუღალტერი');
  assert.equal(suggestSearch('C++'), null);
  assert.equal(suggestSearch('someuniquecompanyname'), null);
  assert.equal(suggestSearch('developer'), null);
});
void test('daily work and daily pay are separate shareable filters; old saved searches gain safe defaults', () => {
  const f = readSearch(
    new URLSearchParams(
      'employment=daily&salaryPeriod=day&salaryFrom=80&salaryTo=150&postedWithin=7',
    ),
  );
  assert.deepEqual(readSearch(searchParams(f)), f);
  const {
    salaryFrom: _,
    salaryTo: __,
    salaryPeriod: ___,
    employment: ____,
    entryLevel: _____,
    postedWithin: ______,
    ...legacy
  } = f;
  const parsed = filtersSchema.parse(legacy);
  assert.equal(parsed.employment, 'all');
  assert.equal(parsed.salaryPeriod, 'month');
  assert.equal(parsed.salaryFrom, null);
  const bad = readSearch(
    new URLSearchParams(
      'salaryFrom=-1&salaryTo=NaN&postedWithin=999&employment=wrong',
    ),
  );
  assert.equal(bad.salaryFrom, null);
  assert.equal(bad.salaryTo, null);
  assert.equal(bad.postedWithin, 0);
  assert.equal(bad.employment, 'all');
});
