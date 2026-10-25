import test from 'node:test';
import assert from 'node:assert/strict';
import { translateUi } from '../lib/ui-language';
import { englishUi } from '../lib/ui-english';
import { categories } from '../lib/types';
import { cities } from '../lib/cities';
import { subcategories } from '../lib/subcategories';
import { roleVocabulary } from '../lib/search-language';
import { factsText } from '../lib/landing-facts';
import { englishLandingHeading } from '../lib/ui-landings';
import { landingFor } from '../lib/seo-landing';

void test('English covers every selectable field, city, specialisation and profession without altering filter values', () => {
  for (const value of [
    ...categories,
    ...cities,
    ...subcategories.map((item) => item.label),
    ...roleVocabulary.map((item) => item.label),
  ]) {
    assert.ok(englishUi[value], `Missing English label: ${value}`);
    assert.equal(translateUi(value, 'ka'), value);
  }
  const unknown = 'დამსაქმებლის ხელშეკრულების ტექსტი';
  assert.equal(translateUi(unknown, 'en'), unknown);
  assert.equal(translateUi('ვაკანსიები ', 'en'), 'Jobs ');
  assert.equal(
    translateUi('{0} — შენახვა', 'en', ['Role $& {1}']),
    'Role $& {1} — Save',
  );
  for (const [key, value] of Object.entries(englishUi))
    assert.deepEqual(
      [...key.matchAll(/\{\d+\}/g)].map((x) => x[0]).sort(),
      [...value.matchAll(/\{\d+\}/g)].map((x) => x[0]).sort(),
      key,
    );
});

void test('English landing labels and salary statistics retain the same meaning and freshness limits', () => {
  const landing = landingFor(
    new URLSearchParams({
      q: 'ჭურჭლის მრეცხავი',
      city: 'თბილისი',
      salaryPeriod: 'day',
    }),
  )!;
  assert.equal(
    englishLandingHeading(landing),
    'Dishwasher jobs in Tbilisi · Daily pay',
  );
  const facts = {
    total: 10,
    fresh: 3,
    salary: { period: 'day' as const, count: 8, low: 60, median: 70, high: 90 },
    employers: [],
  };
  assert.equal(
    factsText(facts, 10, '', 'en').lead,
    '10 active listings, 3 added in the last week.',
  );
  assert.match(
    factsText(facts, 10, '', 'en').salary,
    /middle 50%.*8 listings.*₾60–90 per day/,
  );
  assert.doesNotMatch(factsText(facts, 9, '', 'en').lead, /last week/);
  assert.equal(factsText(facts, 0, '', 'en').salary, '');
});
