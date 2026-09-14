import test from 'node:test';
import assert from 'node:assert/strict';
import { auditChange } from '../worker/importer';

void test('audit truncation preserves an emoji crossing the UTF-16 cut point', () => {
  const prefix = 'a'.repeat(239);
  const description = prefix + '📈' + 'more text';
  const [before, after] = auditChange(
    { description, nested: { facts: [description] } },
    { description: 'updated', nested: { facts: [] } },
  );
  assert.deepEqual(before, {
    description: prefix + `📈…(${description.length})`,
    nested: { facts: [prefix + `📈…(${description.length})`] },
  });
  assert.deepEqual(after, { description: 'updated', nested: { facts: [] } });
  assert.ok(!JSON.stringify(before).includes('\\ud83d'));
});
