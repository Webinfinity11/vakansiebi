import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEvent } from '../lib/server/analytics';

const id = 'a4469adf-daa8-46fb-9449-6b25e086cbb7';

void test('a search is stored folded, and noise is refused rather than trimmed', () => {
  assert.deepEqual(normalizeEvent('search', '  Მოლარე   ოპერატორი '), {
    kind: 'search',
    value: 'მოლარე ოპერატორი',
  });
  assert.equal(
    normalizeEvent('search', 'ა'),
    null,
    'one character is not a search',
  );
  assert.equal(
    normalizeEvent('search', 'x'.repeat(81)),
    null,
    'too long is refused, not cut',
  );
  assert.equal(normalizeEvent('search', 42), null);
});

void test('a view or an outbound click must name a vacancy', () => {
  assert.deepEqual(normalizeEvent('view', id.toUpperCase()), {
    kind: 'view',
    value: id,
  });
  assert.deepEqual(normalizeEvent('outbound', id), {
    kind: 'outbound',
    value: id,
  });
  assert.equal(normalizeEvent('view', 'not-an-id'), null);
  assert.equal(normalizeEvent('outbound', 'https://evil.example'), null);
});

void test('only the four kinds exist; nothing identifying can be passed as a kind', () => {
  for (const kind of ['ip', 'session', 'user', '', null, 'SEARCH'])
    assert.equal(normalizeEvent(kind, 'მოლარე'), null, String(kind));
});
