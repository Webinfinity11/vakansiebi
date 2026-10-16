import test from 'node:test';
import assert from 'node:assert/strict';
import { vacancySearches } from '../lib/vacancy-searches';
import type { LandingCount } from '../lib/seo-landing';

const row = (over: Partial<LandingCount>): LandingCount => ({
  category: null,
  city: null,
  trait: null,
  role: null,
  count: 20,
  ...over,
});
const catalogue = [
  row({ role: 'მოლარე' }),
  row({ role: 'მოლარე', city: 'თბილისი' }),
  row({ category: 'გაყიდვები' }),
  row({ category: 'გაყიდვები', city: 'თბილისი' }),
  row({ city: 'თბილისი' }),
  row({ city: 'ბათუმი' }),
];

void test('vacancy searches use the posting role, field and city with canonical URLs', () => {
  const links = vacancySearches(
    { title: 'მოლარე-კონსულტანტი', category: 'გაყიდვები', city: 'თბილისი' },
    catalogue,
  );
  assert.deepEqual(
    links.map((link) => link.path),
    [
      '/?city=tbilisi&q=molare',
      '/?q=molare',
      '/?category=gayidvebi&city=tbilisi',
      '/?category=gayidvebi',
      '/?city=tbilisi',
    ],
  );
  assert.equal(links[0].label, 'მოლარის ვაკანსიები თბილისში');
  assert.equal(new Set(links.map((link) => link.path)).size, links.length);
});

void test('thin or unrelated pages are excluded and multi-city postings do not invent one location', () => {
  const links = vacancySearches(
    { title: 'მოლარე', category: 'გაყიდვები', city: 'თბილისი, ბათუმი' },
    catalogue.map((item) => (item.role ? { ...item, count: 3 } : item)),
  );
  assert.deepEqual(
    links.map((link) => link.path),
    ['/?category=gayidvebi', '/?city=tbilisi', '/?city=batumi'],
  );
  assert.deepEqual(
    vacancySearches(
      { title: 'ვაკანსია', category: 'სხვა', city: 'სხვა' },
      catalogue,
    ),
    [],
  );
});

void test('a specific compound role wins and inflected role names are understood', () => {
  const rows = [
    row({ role: 'პროექტის მენეჯერი' }),
    row({ role: 'მენეჯერი' }),
    row({ role: 'ბუღალტერი' }),
  ];
  assert.deepEqual(
    vacancySearches(
      { title: 'პროექტის მენეჯერი', category: 'სხვა', city: 'სხვა' },
      rows,
    ).map((link) => link.label),
    ['პროექტის მენეჯერის ვაკანსიები'],
  );
  assert.deepEqual(
    vacancySearches(
      { title: 'ბუღალტრის თანაშემწე', category: 'სხვა', city: 'სხვა' },
      rows,
    ).map((link) => link.label),
    ['ბუღალტერის ვაკანსიები'],
  );
});
