import { distanceMeters, walkMinutes } from './geo';
import type { MapVacancy } from './server/job-map';
import {
  metroMaxWalk,
  metroStations,
  type MetroStation,
} from './tbilisi-metro';

/** The closest station to this workplace; distant workplaces get no metro badge. */
export function nearestMetro(
  place: readonly [number, number, string?],
  maxMinutes = metroMaxWalk,
) {
  const [lat, lon] = place;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  let closest: {
    station: MetroStation;
    meters: number;
    minutes: number;
  } | null = null;
  for (const station of metroStations) {
    const meters = distanceMeters(lat, lon, station.lat, station.lon);
    if (!closest || meters < closest.meters)
      closest = { station, meters, minutes: walkMinutes(meters) };
  }
  return closest && closest.minutes <= maxMinutes ? closest : null;
}

export const metroColors = { 1: '#d64045', 2: '#16856b' } as const;

// Connections follow station order, not the underground tunnel geometry.
export const metroNetwork = {
  type: 'FeatureCollection' as const,
  features: ([1, 2] as const).map((line) => ({
    type: 'Feature' as const,
    properties: { line, color: metroColors[line] },
    geometry: {
      type: 'LineString' as const,
      coordinates: metroStations
        .filter((s) => s.line === line)
        .map((s) => [s.lon, s.lat]),
    },
  })),
};

/** Keep only reachable workplaces, so another branch never puts a pin outside the radius. */
export function vacanciesNearStation(
  list: MapVacancy[],
  station: MetroStation,
  walk: number,
) {
  return list
    .flatMap((v) => {
      const places = v.places
        .map((place) => ({
          place,
          meters: distanceMeters(station.lat, station.lon, place[0], place[1]),
        }))
        .filter((p) => walkMinutes(p.meters) <= walk)
        .sort((a, b) => a.meters - b.meters);
      return places.length
        ? [
            {
              ...v,
              places: places.map((p) => p.place),
              minutes: walkMinutes(places[0].meters),
            },
          ]
        : [];
    })
    .sort(
      (a, b) => a.minutes - b.minutes || Number(b.premium) - Number(a.premium),
    );
}
