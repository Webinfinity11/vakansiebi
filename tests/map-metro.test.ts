import test from 'node:test';
import assert from 'node:assert/strict';
import { nearestMetro, vacanciesNearStation } from '../lib/map-metro';
import { metroPath, stationBySlug } from '../lib/tbilisi-metro';
import type { MapVacancy } from '../lib/server/job-map';

const station = stationBySlug('rustaveli')!;
function job(id: string, places: MapVacancy['places']): MapVacancy {
  return {
    id,
    places,
    title: 'მენეჯერი',
    company: 'კომპანია',
    salary: '',
    salaryPeriod: '',
    logoUrl: '',
    category: 'სხვა',
    city: 'თბილისი',
    premium: false,
    datePosted: '',
  };
}

void test('metro search retains only nearby branches and does not mutate the map catalogue', () => {
  const near: [number, number, string] = [
    station.lat,
    station.lon,
    'მეტროსთან',
  ];
  const far: [number, number, string] = [41.64, 41.63, 'ბათუმი'];
  const original = job('a', [far, near]);
  const results = vacanciesNearStation(
    [original, job('b', [far]), job('empty', [])],
    station,
    5,
  );
  assert.equal(results.length, 1);
  assert.deepEqual(results[0].places, [near]);
  assert.equal(results[0].minutes, 1);
  assert.deepEqual(original.places, [far, near]);
});

void test('walking radius grows from 5 to 10 to 15 minutes and sorts closest first', () => {
  // About 111 meters per 0.001 latitude: 222m/4min, 556m/9min, 890m/14min.
  const list = [
    job('far', [[station.lat + 0.008, station.lon, 'შორი']]),
    job('mid', [[station.lat + 0.005, station.lon, 'შუა']]),
    job('near', [[station.lat + 0.002, station.lon, 'ახლო']]),
  ];
  assert.deepEqual(
    vacanciesNearStation(list, station, 5).map((v) => v.id),
    ['near'],
  );
  assert.deepEqual(
    vacanciesNearStation(list, station, 10).map((v) => v.id),
    ['near', 'mid'],
  );
  assert.deepEqual(
    vacanciesNearStation(list, station, 15).map((v) => v.id),
    ['near', 'mid', 'far'],
  );
  assert.equal(metroPath(station), '/map?station=rustaveli');
});

void test('nearest metro is local to the displayed workplace and hides distant or invalid coordinates', () => {
  const near = nearestMetro([station.lat + 0.002, station.lon]);
  assert.equal(near?.station.slug, 'rustaveli');
  assert.equal(near?.minutes, 4);
  assert.equal(
    nearestMetro([41.64, 41.63]),
    null,
    'Batumi has no Tbilisi metro badge',
  );
  assert.equal(
    nearestMetro([41.9, 44.8]),
    null,
    'a remote Tbilisi workplace gets no badge',
  );
  assert.equal(nearestMetro([NaN, station.lon]), null);
  assert.equal(nearestMetro([station.lat + 0.002, station.lon], 3), null);
});
