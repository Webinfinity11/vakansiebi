import test from 'node:test';
import assert from 'node:assert/strict';
import {
  boardSearchKey,
  readSearch,
  readSearchPage,
  searchParams,
} from '../lib/search-state';
import { categories } from '../lib/types';
import { cityOptions, cityStem, otherCity } from '../lib/cities';
void test('a shared search restores all supported filters without private or preview data', () => {
  const filters = {
    ...readSearch(new URLSearchParams()),
    query: '  ოფისის მენეჯერი  ',
    city: 'თბილისი',
    category: 'ადმინისტრაცია',
    source: 'jobs.ge',
    paid: true,
    remote: true,
    sort: 'მაღალი ხელფასი',
    salaryFrom: 1000,
    salaryTo: 3000,
    employment: 'part-time' as const,
    entryLevel: true,
    postedWithin: 7 as const,
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
void test('every board category is a valid filter and the shared city list keeps "other" as a mode, not a name', () => {
  assert.equal(categories.length, 15);
  for (const category of categories)
    assert.equal(
      readSearch(new URLSearchParams({ category })).category,
      category,
    );
  assert.equal(
    readSearch(new URLSearchParams({ city: otherCity })).city,
    otherCity,
  );
  assert.ok(!cityOptions.slice(0, -1).includes(otherCity));
  assert.equal(cityOptions.at(-1), otherCity);
  assert.equal(cityStem('თბილისი'), 'თბილის');
  assert.equal(cityStem('ბათუმი'), 'ბათუმ');
  assert.equal(cityStem('მცხეთა'), 'მცხეთა');
  assert.equal(cityStem('ფოთი'), 'ფოთ');
});

void test('control characters never reach the database from a typed filter', () => {
  const read = readSearch(new URLSearchParams('q=მოლ%00არე%0A&city=%00'));
  assert.equal(read.query, 'მოლარე');
  assert.equal(
    read.city,
    'ყველა',
    'a city made only of control characters means no city',
  );
});

void test('SSR and client identify the same normalized URL without sharing private lists', () => {
  const url = new URLSearchParams(
    'q=%20მენეჯერი%20&category=გაყიდვები&salaryFrom=1000&sort=salary&page=2&utm_source=test&exclude=untrusted',
  );
  const server = readSearch(url);
  const client = readSearch(searchParams(server));
  assert.equal(boardSearchKey(server), boardSearchKey(client));
  assert.equal(readSearchPage(url), 2);
  assert.notEqual(
    boardSearchKey(server),
    boardSearchKey(server, { excluded: 'hidden-id' }),
  );
  assert.notEqual(
    boardSearchKey(server),
    boardSearchKey(server, { savedOnly: true }),
  );
  assert.notEqual(
    boardSearchKey(server),
    boardSearchKey(server, { preview: true }),
  );
  assert.notEqual(
    boardSearchKey(server, { savedOnly: true, saved: ['a'] }),
    boardSearchKey(server, { savedOnly: true, saved: ['b'] }),
  );
  assert.equal(
    boardSearchKey(server, { saved: ['a'] }),
    boardSearchKey(server),
  );
  assert.equal(
    boardSearchKey(server, { excluded: 'b,a' }),
    boardSearchKey(server, { excluded: 'a,b' }),
  );
  for (const [raw, page] of [
    ['', 1],
    ['invalid', 1],
    ['-4', 1],
    ['2.9', 2],
    ['10001', 10000],
  ] as const)
    assert.equal(readSearchPage(new URLSearchParams({ page: raw })), page);
});
