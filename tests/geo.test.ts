import test from 'node:test';
import assert from 'node:assert/strict';
import {
  circleRing,
  distanceMeters,
  formatDistance,
  formatWalk,
  walkMinutes,
  walkReachMeters,
} from '../lib/geo';
import { metroStations, stationBySlug } from '../lib/tbilisi-metro';

void test('haversine distance matches known ground distances', () => {
  assert.equal(distanceMeters(41.7, 44.8, 41.7, 44.8), 0);
  // One degree of latitude is about 111.2 km anywhere.
  assert.ok(Math.abs(distanceMeters(41, 44.8, 42, 44.8) - 111_195) < 50);
  // Rustaveli to Liberty Square is a little under 1.4 km as the crow flies.
  const a = stationBySlug('rustaveli')!;
  const b = stationBySlug('liberty-square')!;
  const d = distanceMeters(a.lat, a.lon, b.lat, b.lon);
  assert.ok(d > 1300 && d < 1450, `got ${d}`);
  assert.equal(d, distanceMeters(b.lat, b.lon, a.lat, a.lon));
});

void test('walking minutes add a 25% detour at 80 m a minute, rounded up', () => {
  assert.equal(walkMinutes(0), 1, 'at the door is still a minute');
  assert.equal(walkMinutes(64), 1);
  assert.equal(walkMinutes(65), 2);
  assert.equal(walkMinutes(320), 5);
  assert.equal(walkMinutes(640), 10);
  assert.equal(walkMinutes(641), 11);
  assert.equal(walkMinutes(960), 15);
  for (const m of [5, 10, 15])
    assert.equal(walkMinutes(walkReachMeters(m)), m, 'the reach is inclusive');
});

void test('distances and walks read the Georgian way', () => {
  assert.equal(formatDistance(348), '350 მ');
  assert.equal(formatDistance(3), '10 მ');
  assert.equal(formatDistance(994), '990 მ');
  assert.equal(formatDistance(1234), '1,2 კმ');
  assert.equal(formatDistance(12_345), '12,3 კმ');
  assert.equal(formatWalk(5), '5 წთ ფეხით');
});

void test('a radius circle closes and keeps its distance', () => {
  const ring = circleRing(41.7, 44.8, 640, 32);
  assert.equal(ring.length, 33);
  assert.deepEqual(ring[0], ring[32]);
  for (const [lon, lat] of ring)
    assert.ok(Math.abs(distanceMeters(41.7, 44.8, lat, lon) - 640) < 3);
});

void test('the station list is the real network: 16 + 7, unique slugs, inside Tbilisi', () => {
  assert.equal(metroStations.filter((s) => s.line === 1).length, 16);
  assert.equal(metroStations.filter((s) => s.line === 2).length, 7);
  assert.equal(new Set(metroStations.map((s) => s.slug)).size, 23);
  for (const s of metroStations)
    assert.ok(s.lat > 41.64 && s.lat < 41.8 && s.lon > 44.7 && s.lon < 44.9);
});
