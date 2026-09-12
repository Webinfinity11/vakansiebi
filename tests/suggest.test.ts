import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  suggestPrefix,
  likePattern,
  suggestTerms,
} from '../lib/server/suggest';

void test('suggestion prefixes are normalised, bounded and LIKE-safe', () => {
  assert.equal(
    suggestPrefix('  Გაყიდვების   მენეჯერი '),
    'გაყიდვების მენეჯერი',
  );
  assert.equal(suggestPrefix('a'), null);
  assert.equal(suggestPrefix(' '), null);
  assert.equal(suggestPrefix('x'.repeat(80))?.length, 60);
  assert.equal(likePattern('100%_a\\b'), '100\\%\\_a\\\\b');
});

void test(
  'suggestions come back shaped as title/company terms with counts',
  { skip: process.env.RUN_DB_TESTS !== '1' },
  async () => {
    const rows = await suggestTerms('გა', 5);
    assert.ok(rows.length <= 5);
    for (const row of rows) {
      assert.equal(typeof row.value, 'string');
      assert.ok(row.kind === 'title' || row.kind === 'company');
      assert.ok(Number.isInteger(row.count) && row.count > 0);
    }
    assert.deepEqual(await suggestTerms('a'), []);
  },
);
