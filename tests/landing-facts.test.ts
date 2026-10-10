import test from 'node:test';
import assert from 'node:assert/strict';
import { factsText, type LandingFacts } from '../lib/landing-facts';

const facts = (over: Partial<LandingFacts> = {}): LandingFacts => ({
  total: 249,
  fresh: 14,
  salary: { period: 'day', count: 200, low: 60, median: 70, high: 90 },
  employers: [
    { slug: 'a', name: 'A', count: 7 },
    { slug: 'b', name: 'B', count: 3 },
  ],
  ...over,
});

void test('the figures read as Georgian whatever the list holds', () => {
  const full = factsText(facts());
  assert.equal(
    full.lead,
    'ახლა აქტიურია 249 განცხადება, მათ შორის 14 ბოლო 7 დღეში დაემატა.',
  );
  assert.equal(
    full.salary,
    'მითითებული ხელფასი უმეტესად 60-დან 90 ₾-მდეა დღეში.',
  );
  assert.equal(full.employers, 'ყველაზე აქტიური დამსაქმებლები:');

  const empty = factsText(facts(), 0);
  assert.match(empty.lead, /აქტიური განცხადება არ არის/);
  assert.equal(empty.salary, '');
  assert.equal(empty.employers, '');

  assert.equal(
    factsText(facts({ fresh: 0, salary: null, employers: [] })).lead,
    'ახლა აქტიურია 249 განცხადება.',
  );
  assert.equal(
    factsText(facts({ fresh: 30 }), 12).lead,
    'ახლა აქტიურია 12 განცხადება, ყველა მათგანი ბოლო 7 დღეში დაემატა.',
  );
  assert.equal(
    factsText(facts({ fresh: 1 }), 1).lead,
    'ახლა აქტიურია 1 განცხადება, რომელიც ბოლო 7 დღეში დაემატა.',
  );
  assert.equal(
    factsText(
      facts({
        salary: {
          period: 'month',
          count: 9,
          low: 1500,
          median: 1500,
          high: 1500,
        },
        employers: [{ slug: 'a', name: 'A', count: 2 }],
      }),
    ).salary,
    'მითითებული ხელფასი უმეტესად 1 500 ₾-ია თვეში.',
  );
  assert.equal(
    factsText(facts({ employers: [{ slug: 'a', name: 'A', count: 2 }] }))
      .employers,
    'ყველაზე აქტიური დამსაქმებელი:',
  );
  assert.equal(
    factsText(
      facts({
        salary: {
          period: 'month',
          count: 14,
          low: 900,
          median: 1000,
          high: 1275,
        },
      }),
    ).salary,
    'მითითებული ხელფასი უმეტესად 900-დან 1\u00a0300 ₾-მდეა თვეში.',
  );
  assert.equal(
    factsText(facts(), 2500).lead,
    'ახლა აქტიურია 2 500 განცხადება, მათ შორის 14 ბოლო 7 დღეში დაემატა.',
  );
});
