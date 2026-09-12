import test from 'node:test';
import assert from 'node:assert/strict';
import { searchPlan } from '../lib/server/search-plan';

/* The comparable salary columns are skipped unless the query needs them, which once left the
   category pay spread reading NULL from every row and showing nothing at all. */
void test('a caller can ask for the salary columns without filtering by pay', () => {
  const plain = searchPlan(new URLSearchParams(), false, { grouped: true });
  assert.match(plain.cte, /NULL::numeric AS salary_month/);
  const priced = searchPlan(new URLSearchParams(), false, {
    grouped: true,
    pricing: true,
  });
  assert.doesNotMatch(priced.cte, /NULL::numeric AS salary_month/);
  assert.match(priced.cte, /AS salary_month/);
  assert.match(priced.cte, /AS salary_day/);
});

void test('a monthly figure is compared only when it is plausible as a month of pay', () => {
  const priced = searchPlan(new URLSearchParams(), false, {
    grouped: true,
    pricing: true,
  });
  // 1 and 111,111 are placeholders; below 100 GEL the sampled records were day or shift rates.
  assert.match(priced.cte, /BETWEEN 100 AND 50000/);
  // A rate per square metre is not a month's pay, whatever its size.
  assert.match(priced.cte, /მ²/);
});
