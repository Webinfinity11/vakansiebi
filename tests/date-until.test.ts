import test from 'node:test';
import assert from 'node:assert/strict';
import { untilDate } from '../lib/date-until';

const now = new Date('2026-06-01T00:00:00+04:00');

test('all twelve Georgian month endings', () => {
  const months = ['იანვრამდე', 'თებერვლამდე', 'მარტამდე', 'აპრილამდე', 'მაისამდე', 'ივნისამდე', 'ივლისამდე', 'აგვისტომდე', 'სექტემბრამდე', 'ოქტომბრამდე', 'ნოემბრამდე', 'დეკემბრამდე'];
  months.forEach((month, i) => assert.equal(untilDate(`2026-${String(i + 1).padStart(2, '0')}-26`, now), `26 ${month}`));
});

test('year is included only when different, using the Tbilisi year for now', () => {
  assert.equal(untilDate('2027-01-03', now), '2027 წლის 3 იანვრამდე');
  assert.equal(untilDate('2025-12-26', now), '2025 წლის 26 დეკემბრამდე');
  assert.equal(untilDate('2027-01-03', new Date('2026-12-31T20:00:00Z')), '3 იანვრამდე');
});

test('timestamps on either side of Tbilisi midnight, including New Year', () => {
  assert.equal(untilDate('2026-11-26T19:59:59Z', now), '26 ნოემბრამდე');
  assert.equal(untilDate('2026-11-26T20:00:00Z', now), '27 ნოემბრამდე');
  assert.equal(untilDate('2026-12-31T19:59:59Z', now), '31 დეკემბრამდე');
  assert.equal(untilDate('2026-12-31T20:00:00Z', now), '2027 წლის 1 იანვრამდე');
  assert.equal(untilDate(new Date('2026-11-26T20:00:00Z'), now), '27 ნოემბრამდე');
  assert.equal(untilDate(Date.parse('2026-11-26T20:00:00Z'), now), '27 ნოემბრამდე');
});

test('invalid inputs return an empty string; valid leap dates remain valid', () => {
  for (const value of ['', 'bad', '2026-02-30', '2026-02-29T12:00:00Z', '2026-13-01', '2026-00-01', NaN, Infinity, new Date(NaN)]) {
    assert.equal(untilDate(value, now), '');
  }
  assert.equal(untilDate('2024-02-29', now), '2024 წლის 29 თებერვლამდე');
  assert.equal(untilDate('2026-11-26', new Date(NaN)), '');
});
