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

void test('the process events keep their two shapes: a vacancy, or a step name', () => {
  for (const kind of ['call', 'cv', 'apply'] as const) {
    assert.deepEqual(normalizeEvent(kind, id), { kind, value: id });
    assert.equal(
      normalizeEvent(kind, 'დარეკვა'),
      null,
      'a contact event names the vacancy, never the reader',
    );
  }
  assert.deepEqual(normalizeEvent('post', 'left_details'), {
    kind: 'post',
    value: 'left_details',
  });
  assert.deepEqual(normalizeEvent('post', 'invalid_salaryFrom'), {
    kind: 'post',
    value: 'invalid_salaryFrom',
  });
  assert.equal(
    normalizeEvent('post', 'რეზიუმე ჩემი'),
    null,
    'a step is a code name, so no typed text can arrive as one',
  );
  for (const value of ['section_skills', 'left_experience'])
    assert.deepEqual(normalizeEvent('resume', value), {
      kind: 'resume',
      value,
    });
  for (const value of ['რეზიუმე', 'a', 'a'.repeat(25), 'section-skills'])
    assert.equal(normalizeEvent('resume', value), null);
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
  const numericId = '12345678-1234-1234-1234-123456789012';
  for (const kind of ['view', 'outbound'])
    assert.deepEqual(normalizeEvent(kind, numericId), {
      kind,
      value: numericId,
    });
  assert.equal(normalizeEvent('view', 'not-an-id'), null);
  assert.equal(normalizeEvent('outbound', 'https://evil.example'), null);
});

void test('searches containing obvious contacts or long numbers are refused after normalization', () => {
  for (const kind of ['search', 'search_empty'])
    for (const query of [
      'მოლარე JOBS@EXAMPLE.GE თბილისი',
      'მოლარე jobs＠example．ge',
      'მოლარე 599 12 34 56',
      'მოლარე +995 (599) 12-34.56',
      'მოლარე 1+2(3)4.5-6 7',
      'მოლარე 1234567',
      'მოლარე 12345678901',
      'მოლარე 123456789012',
      'მოლარე ５９９\t１２\n３４\u00a0５６',
    ])
      assert.equal(normalizeEvent(kind, query), null, `${kind}: ${query}`);
});

void test('ordinary searches with short numbers remain valid', () => {
  for (const kind of ['search', 'search_empty'])
    for (const query of [
      'ბუღალტერი 2 წლიანი',
      '1c 8.3',
      'კოდი 123456',
      'კოდი 12 34 56',
    ])
      assert.deepEqual(normalizeEvent(kind, query), { kind, value: query });
});

void test('only the four kinds exist; nothing identifying can be passed as a kind', () => {
  for (const kind of ['ip', 'session', 'user', '', null, 'SEARCH'])
    assert.equal(normalizeEvent(kind, 'მოლარე'), null, String(kind));
});
