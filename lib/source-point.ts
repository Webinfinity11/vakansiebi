import type { Vacancy } from './types';
import { cities } from './cities';
import { cityCentre, distanceKm } from './nearest-city';

/* A map pin the source itself published — an employer's point on the board's own map — places
   a vacancy whose written address the geocoder cannot. It is checked first, because a pin left
   at a map's default or dropped in the wrong town misleads more than no pin: it must lie inside
   Georgia and within `nearKm` of the one listed city the vacancy names. A vacancy naming no
   listed city, or several, keeps only its written address. */
const nearKm = 30;
const georgia = { south: 41.0, north: 43.6, west: 40.0, east: 46.8 };

export function sourcePoint(
  job: Pick<Vacancy, 'coordinates' | 'city'>,
): { lat: number; lon: number } | null {
  const point = job.coordinates;
  if (!point) return null;
  const { lat, lon } = point;
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    lat < georgia.south ||
    lat > georgia.north ||
    lon < georgia.west ||
    lon > georgia.east
  )
    return null;
  // "ქ. თბილისი", "თბილისი >> ვარკეთილი": the city is a whole word of the field.
  const words = (job.city || '').normalize('NFKC').split(/[^ა-ჰ-]+/);
  const named = cities.filter((city) => words.includes(city));
  if (named.length !== 1) return null;
  const centre = cityCentre(named[0]);
  if (!centre || distanceKm(lat, lon, centre[0], centre[1]) > nearKm)
    return null;
  return {
    lat: Number(lat.toFixed(6)),
    lon: Number(lon.toFixed(6)),
  };
}
