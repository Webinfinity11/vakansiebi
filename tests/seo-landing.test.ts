import test from 'node:test';
import assert from 'node:assert/strict';
import {
  landingFor,
  landingHeading,
  landingLinks,
  landingOf,
} from '../lib/seo-landing';
import { readSearch } from '../lib/search-state';

/* What the index is opened to decides what the site is found by — and what it is
   buried under. The rule is narrow on purpose, so it is checked from both ends. */
void test('a category, a city and remote work are pages; everything else is a filter', () => {
  for (const address of [
    'category=გაყიდვები',
    'city=ბათუმი',
    'remote=true',
    'category=გაყიდვები&city=თბილისი',
    'category=ფინანსები&remote=true',
  ])
    assert.ok(landingFor(new URLSearchParams(address)), address);
  for (const address of [
    '',
    'q=მოლარე',
    'page=2',
    'sort=salary',
    'category=გაყიდვები&q=მოლარე',
    'category=გაყიდვები&page=3',
    'city=ბათუმი&salaryFrom=1000',
    'saved=1',
    'preview=1',
    // Unreviewed values name no page: a category that does not exist, a city
    // that is not offered, and the catch-all category that describes nothing.
    'category=არარსებული',
    'city=ლონდონი',
    'category=სხვა',
    'remote=false',
  ])
    assert.equal(landingFor(new URLSearchParams(address)), null, address);
});
void test('a landing page names itself the way a reader would say it', () => {
  const heading = (address: string) =>
    landingHeading(landingFor(new URLSearchParams(address))!);
  assert.equal(
    heading('category=გაყიდვები&city=თბილისი'),
    'გაყიდვების ვაკანსიები თბილისში',
  );
  assert.equal(heading('city=ბათუმი'), 'ვაკანსიები ბათუმში');
  assert.equal(
    heading('category=ფინანსები'),
    'ფინანსების ვაკანსიები საქართველოში',
  );
  assert.equal(heading('remote=true'), 'დისტანციური ვაკანსიები');
  assert.equal(
    heading('category=მარკეტინგი&remote=true'),
    'მარკეტინგის დისტანციური ვაკანსიები',
  );
  // Two of the categories are adjectives already and are not declined.
  assert.equal(
    heading('category=სამედიცინო'),
    'სამედიცინო ვაკანსიები საქართველოში',
  );
});
void test('the list on screen claims the name only when it is exactly that list', () => {
  const of = (address: string) =>
    landingOf(readSearch(new URLSearchParams(address)));
  // The path is percent-encoded, as a canonical URL has to be.
  assert.equal(
    decodeURIComponent(of('category=დაცვა&city=ქუთაისი')?.path ?? ''),
    '/?category=დაცვა&city=ქუთაისი',
  );
  assert.equal(of(''), null);
  assert.equal(of('q=მოლარე&category=დაცვა'), null);
  assert.equal(of('category=დაცვა&entryLevel=true'), null);
});
void test('every linked list is one the index is open to', () => {
  const links = landingLinks();
  assert.ok(links.length >= 20);
  for (const { path, label } of links) {
    assert.ok(path.startsWith('/?'), path);
    assert.ok(
      landingFor(new URLSearchParams(path.slice(2))),
      `${path} is linked but not indexable`,
    );
    assert.ok(label.includes('ვაკანსიები'), label);
  }
  assert.equal(new Set(links.map((l) => l.path)).size, links.length);
});
