import test from 'node:test';
import assert from 'node:assert/strict';
import { nearestCity, distanceKm } from '../lib/nearest-city';
void test('a position inside a listed city resolves to that city within a few km', () => {
  const tbilisi = nearestCity(41.7, 44.8);
  assert.equal(tbilisi.city, 'თბილისი');
  assert.ok(tbilisi.km < 5, `expected under 5 km, got ${tbilisi.km}`);
  const batumi = nearestCity(41.65, 41.64);
  assert.equal(batumi.city, 'ბათუმი');
  assert.ok(batumi.km < 5);
});
void test('a position far outside Georgia still returns the nearest option with its distance', () => {
  const istanbul = nearestCity(41.0082, 28.9784);
  assert.equal(istanbul.city, 'ბათუმი');
  assert.ok(istanbul.km > 900 && istanbul.km < 1200, `got ${istanbul.km}`);
});
void test('distance is symmetric and zero for identical points', () => {
  assert.equal(distanceKm(41.7, 44.8, 41.7, 44.8), 0);
  assert.equal(
    Math.round(distanceKm(41.7, 44.8, 42.2, 42.7)),
    Math.round(distanceKm(42.2, 42.7, 41.7, 44.8)),
  );
});
