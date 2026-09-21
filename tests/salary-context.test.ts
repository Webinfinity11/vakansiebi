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
  // A monthly wage labelled "per day" is not ranked among day rates; a small day rate is kept.
  assert.match(priced.cte, /<= 500 AND[^']*'დღე' THEN/);
});

void test('duplicate grouping never joins two vacancies on a name that identifies no employer', async () => {
  const { genericCompanyKeys } = await import('../lib/company-logo-identity');
  for (const key of ['კომპანია', 'company', 'გიორგი', 'სასტუმრო'])
    assert.ok(genericCompanyKeys.has(key), key);
  const plan = searchPlan(new URLSearchParams(), false, { grouped: true });
  // Placeholder names and single letters get their own group; two letters may be a brand.
  assert.match(plan.cte, /IN \('კომპანია'/);
  assert.match(plan.cte, /< 2 OR/);
});

void test('child facets retain other filters but ignore the selected child', () => {
  const plan = searchPlan(
    new URLSearchParams({
      category: 'ტექნოლოგიები',
      subcategory: 'tech-development',
      city: 'თბილისი',
      paid: 'true',
    }),
    false,
    { grouped: true },
  );
  const facet = plan.metrics.slice(
    plan.metrics.indexOf('(SELECT jsonb_agg(facet)'),
  );
  const eligible = facet.match(/SELECT title FROM matches WHERE ([^)]+)/)?.[1];
  assert.ok(eligible);
  for (const key of ['category', 'city', 'paid', 'query', 'salary', 'remote'])
    assert.ok(eligible.includes(`"${key}"`), key);
  assert.ok(!eligible.includes('"subcategory"'));
  assert.match(
    facet,
    /count\(m.title\) FILTER \(WHERE m.title ~ child.pattern\)/,
  );
  assert.match(facet, /LEFT JOIN/); // Empty parents must still expose zero-count children.
  assert.ok(facet.includes('tech-development'));
  assert.ok(!facet.includes('sales-retail'));
});

void test('parents without children do not evaluate child patterns', () => {
  for (const category of ['ყველა', 'სხვა']) {
    const plan = searchPlan(new URLSearchParams({ category }), false, {
      grouped: true,
    });
    assert.match(plan.metrics, /'\[\]'::jsonb subcategories/);
    assert.doesNotMatch(plan.metrics, /child\.pattern/);
  }
});
