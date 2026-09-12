import test from 'node:test';
import assert from 'node:assert/strict';
import {
  searchGroups,
  stemGeorgian,
  suggestSearch,
} from '../lib/search-language';
import { readSearch, searchParams } from '../lib/search-state';
import { filtersSchema } from '../lib/personal-space';
void test('reviewed role equivalents preserve all query terms and technical punctuation', () => {
  assert.ok(searchGroups('ბუღალტერია')[0].includes('accountant'));
  assert.ok(searchGroups('დეველოპერი')[0].includes('developer'));
  assert.deepEqual(searchGroups('C++ C#'), [['c++'], ['c#']]);
  assert.equal(searchGroups('senior დეველოპერი').length, 2);
  assert.deepEqual(
    searchGroups('ბუღალტრის')[0],
    ['ბუღალტრ'],
    'a case ending is stripped, but no general Georgian morphology is pretended',
  );
});
void test('a light suffix stripper turns a query word into the stem the texts share', () => {
  assert.equal(stemGeorgian('თბილისში'), 'თბილის');
  assert.equal(stemGeorgian('ოფისის'), 'ოფის');
  assert.equal(stemGeorgian('ფასებს'), 'ფას');
  assert.equal(stemGeorgian('მენეჯერი'), 'მენეჯერ');
  assert.equal(stemGeorgian('ბოსი'), 'ბოს');
  assert.equal(stemGeorgian('ისი'), 'ისი', 'stems stay at least three letters');
  assert.equal(stemGeorgian('developer'), 'developer');
  assert.deepEqual(searchGroups('თბილისში მენეჯერი'), [
    ['თბილის'],
    ['მენეჯერ', 'მენეჯერი', 'manager', 'менеджер'],
  ]);
});
void test('Russian role names reach the same reviewed group, including inflected forms', () => {
  assert.ok(searchGroups('бухгалтер')[0].includes('ბუღალტერ'));
  assert.ok(searchGroups('бухгалтера')[0].includes('accountant'));
  assert.ok(searchGroups('водитель')[0].includes('მძღოლ'));
  assert.ok(searchGroups('охранник')[0].includes('მცველ'));
  assert.ok(searchGroups('врач')[0].includes('ექიმ'));
  assert.deepEqual(
    searchGroups('менеджер по продажам').map((group) => group[0]),
    ['менеджер', 'продажам'],
  );
  assert.ok(searchGroups('менеджер по продажам')[1].includes('გაყიდვ'));
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
