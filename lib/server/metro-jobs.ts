import { distanceMeters, walkMinutes } from '../geo';
import {
  metroDefaultWalk,
  metroMaxWalk,
  metroStations,
  type MetroStation,
} from '../tbilisi-metro';
import { mapVacancies, type MapVacancy } from './job-map';

export type MetroVacancy = Pick<
  MapVacancy,
  'id' | 'title' | 'company' | 'salary' | 'salaryPeriod' | 'logoUrl' | 'premium'
> & {
  meters: number;
  minutes: number;
  /** The workplace nearest the station: [lat, lon, label]. */
  place: [number, number, string];
};

/* The /map query returns every placed vacancy at once. A station page needs all of them to
   measure distances, so one copy is kept for a few minutes — the same freshness /api/map allows
   at the edge — instead of a query per station view. */
const keepFor = 5 * 60_000;
let memo: { at: number; rows: Promise<MapVacancy[]> } | null = null;
function placedVacancies() {
  if (!memo || Date.now() - memo.at > keepFor) {
    const rows = mapVacancies();
    memo = { at: Date.now(), rows };
    rows.catch(() => {
      if (memo?.rows === rows) memo = null;
    });
  }
  return memo.rows;
}

function nearestPlace(v: MapVacancy, s: MetroStation) {
  let best: { meters: number; place: [number, number, string] } | null = null;
  for (const place of v.places) {
    const meters = distanceMeters(s.lat, s.lon, place[0], place[1]);
    if (!best || meters < best.meters) best = { meters, place };
  }
  return best;
}

/** Vacancies with a workplace within a `maxMinutes` walk of the station, nearest first. */
export async function stationVacancies(
  station: MetroStation,
  maxMinutes = metroMaxWalk,
): Promise<MetroVacancy[]> {
  const out: MetroVacancy[] = [];
  for (const v of await placedVacancies()) {
    const near = nearestPlace(v, station);
    if (!near || walkMinutes(near.meters) > maxMinutes) continue;
    out.push({
      id: v.id,
      title: v.title,
      company: v.company,
      salary: v.salary,
      salaryPeriod: v.salaryPeriod,
      logoUrl: v.logoUrl,
      premium: v.premium,
      meters: Math.round(near.meters),
      minutes: walkMinutes(near.meters),
      place: near.place,
    });
  }
  return out.sort(
    (a, b) =>
      a.minutes - b.minutes ||
      Number(b.premium) - Number(a.premium) ||
      a.meters - b.meters,
  );
}

/** How many vacancies each station has within a `minutes` walk, by slug. */
export async function stationCounts(minutes = metroDefaultWalk) {
  const vacancies = await placedVacancies();
  const counts: Record<string, number> = {};
  for (const s of metroStations)
    counts[s.slug] = vacancies.filter((v) => {
      const near = nearestPlace(v, s);
      return !!near && walkMinutes(near.meters) <= minutes;
    }).length;
  return counts;
}
