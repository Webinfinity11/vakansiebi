import test from 'node:test';
import assert from 'node:assert/strict';
import type { Pool } from 'pg';
import { discoverItems } from '../worker/importer';

void test('fresh discovery stores listing hints without rewriting existing vacancies first', async () => {
  const shared = globalThis as unknown as { ertadPool?: Pool };
  const previous = shared.ertadPool;
  const previousUrl = process.env.DATABASE_URL;
  const queries: { text: string; values: unknown[] }[] = [];
  process.env.DATABASE_URL = 'postgres://unused';
  shared.ertadPool = {
    query: async (text: string, values: unknown[]) => {
      queries.push({ text, values });
      return { rows: [] };
    },
  } as unknown as Pool;
  try {
    await discoverItems('jobs', [{
      externalId: '123',
      url: 'https://jobs.ge/?view=jobs&id=123',
      hints: { category: 'ფინანსები' },
    }], { updateStoredHints: false });
    assert.equal(queries.length, 1);
    assert.match(queries[0].text, /INSERT INTO source_items/);
    assert.deepEqual(queries[0].values[4], { category: 'ფინანსები' });
  } finally {
    shared.ertadPool = previous;
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
  }
});
