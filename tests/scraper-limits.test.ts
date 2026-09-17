import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import {
  effectiveScraperLimits,
  scraperLimitFields,
} from '../lib/scraper-limits';

void test('admin settings lower each runner ceiling and keep zero discovery pages', () => {
  assert.deepEqual(
    effectiveScraperLimits(
      { batch_limit: 100, budget_minutes: 4, discovery_page_limit: 0 },
      { batch: 200, minutes: 8, pages: 3 },
    ),
    { batch: 100, minutes: 4, pages: 0 },
  );
  assert.deepEqual(
    effectiveScraperLimits(
      { batch_limit: 200, budget_minutes: 8, discovery_page_limit: 3 },
      { batch: 25, minutes: 2, pages: 1 },
    ),
    { batch: 25, minutes: 2, pages: 1 },
  );
  assert.deepEqual(
    effectiveScraperLimits({}, { batch: 100, minutes: 5, pages: 3 }),
    { batch: 100, minutes: 5, pages: 3 },
  );
});

void test('limit validation accepts pauses and rejects unbounded or fractional settings', () => {
  const schema = z.object(scraperLimitFields);
  assert.equal(
    schema.safeParse({ discoveryPageLimit: 0, repairLimit: 0 }).success,
    true,
  );
  for (const value of [
    { batchLimit: 0 },
    { batchLimit: 201 },
    { budgetMinutes: 9 },
    { budgetMinutes: 1.5 },
    { discoveryPageLimit: 4 },
    { repairLimit: -1 },
    { repairLimit: 21 },
  ])
    assert.equal(schema.safeParse(value).success, false, JSON.stringify(value));
});
