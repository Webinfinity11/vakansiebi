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
