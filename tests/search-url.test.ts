import test from 'node:test';
import assert from 'node:assert/strict';
import { categories } from '../lib/types';
import { cities } from '../lib/cities';
import { roleVocabulary } from '../lib/search-language';
import { canonicalSearchParams, searchUrlValue } from '../lib/search-url';
import { readSearch } from '../lib/search-state';
import { landingFor } from '../lib/seo-landing';
import { employerSlug, legacyEmployerSlug } from '../lib/employer-identity';

void test('Latin URLs round trip to the same Georgian filters without collisions', () => {
  for (const [key, values] of Object.entries({
    category: categories,
    city: cities,
    q: roleVocabulary.map((r) => r.label),
  })) {
    const slugs = values.map((value) => searchUrlValue(key, value));
    assert.equal(new Set(slugs).size, values.length);
    for (const value of values) {
      const legacy = new URLSearchParams({ [key]: value });
      const canonical = canonicalSearchParams(legacy);
      assert.doesNotMatch(canonical.toString(), /%[A-F0-9]{2}/);
      assert.deepEqual(readSearch(canonical), readSearch(legacy));
      assert.deepEqual(landingFor(canonical), landingFor(legacy));
      assert.equal(
        canonicalSearchParams(canonical).toString(),
        canonical.toString(),
      );
    }
  }
});

void test('migration preserves free text, tracking and pagination; employer names get Latin slugs', () => {
  const old = new URLSearchParams({
    category: 'გაყიდვები',
    city: 'თბილისი',
    page: '2',
    utm_source: 'mail',
    q: 'არასტანდარტული საძიებო ტექსტი',
  });
  const next = canonicalSearchParams(old);
  assert.equal(next.get('category'), 'gaqidvebi');
  assert.equal(next.get('city'), 'tbilisi');
  for (const key of ['page', 'utm_source', 'q'])
    assert.equal(next.get(key), old.get(key));
  assert.equal(employerSlug('ლიბერთი ბანკი'), 'liberti-banki');
  assert.equal(legacyEmployerSlug('ლიბერთი ბანკი'), 'ლიბერთი-ბანკი');
  assert.equal(employerSlug('Café Brød'), 'cafe-brod');
  assert.equal(employerSlug('Данило Панчишин'), 'danilo-panchishin');
});
