import test from 'node:test';
import assert from 'node:assert/strict';
import { searchSeo } from '../lib/search-seo';

void test('public pagination has distinct canonicals and page titles', () => {
  const first = searchSeo(new URLSearchParams());
  const next = searchSeo(new URLSearchParams('page=2'));
  assert.equal(first.path, '/');
  assert.equal(next.path, '/?page=2');
  assert.equal(next.index, true);
  assert.notEqual(first.title, next.title);
  assert.match(next.title, /გვერდი 2/);
});

void test('paginated landing pages retain their topic and strip tracking', () => {
  const params = new URLSearchParams(
    'city=ბათუმი&category=გაყიდვები&page=3&utm_source=mail',
  );
  const seo = searchSeo(params);
  assert.equal(seo.path, '/?category=gayidvebi&city=batumi&page=3');
  assert.equal(seo.index, true);
  assert.match(seo.title, /გაყიდვების ვაკანსიები ბათუმში.*გვერდი 3/);
  assert.match(seo.description, /ბათუმში/);
  assert.equal(params.get('utm_source'), 'mail');
});

void test('pagination never makes arbitrary searches or private filters indexable', () => {
  for (const query of [
    'q=unknown-position',
    'saved=1',
    'preview=1',
    'salaryFrom=1000',
    'sort=salary',
  ]) {
    const seo = searchSeo(new URLSearchParams(query + '&page=2'));
    assert.equal(seo.index, false, query);
    assert.ok(seo.path.includes('page=2'));
    assert.ok(seo.path.includes(query));
  }
});

void test('reviewed profession conditions have distinct titles and canonical URLs without opening arbitrary combinations', () => {
  const cases = [
    [
      'q=ჭურჭლის მრეცხავი&salaryPeriod=day',
      'ჭურჭლის მრეცხავის ვაკანსიები დღიური ანაზღაურებით',
    ],
    ['q=დეველოპერი&remote=true', 'დეველოპერის დისტანციური ვაკანსიები'],
    [
      'q=ბუღალტერი&employment=part-time&city=თბილისი',
      'ბუღალტერის ვაკანსიები ნახევარ განაკვეთზე თბილისში',
    ],
    ['q=ექთანი&employment=part-time', 'ექთნის ვაკანსიები ნახევარ განაკვეთზე'],
  ];
  for (const [query, heading] of cases) {
    const seo = searchSeo(new URLSearchParams(query));
    assert.equal(seo.index, true);
    assert.equal(seo.title, heading + ' | JOBX');
    assert.equal(
      searchSeo(new URLSearchParams(seo.path.slice(2))).path,
      seo.path,
    );
    assert.ok(seo.description.includes(heading));
  }
  for (const query of [
    'q=ექთანი&remote=true',
    'q=მოლარე&remote=true',
    'q=ჭურჭლის მრეცხავი&salaryPeriod=day&paid=true',
  ])
    assert.equal(searchSeo(new URLSearchParams(query)).index, false, query);
});

void test('page one and tracking-only addresses consolidate to the homepage', () => {
  for (const query of [
    'page=1',
    'page=-3',
    'page=oops',
    'utm_source=mail&gclid=123&fbclid=abc',
  ]) {
    const seo = searchSeo(new URLSearchParams(query));
    assert.equal(seo.path, '/');
    assert.equal(seo.index, true);
  }
});
