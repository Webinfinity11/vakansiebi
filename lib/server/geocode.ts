import type { StreetAddress } from '../street-address';

/* Street address → map point, through OpenStreetMap's Nominatim.

   The service is free on two conditions: at most one request a second, and every answer
   kept so the same address is never asked twice. The caller owns the pacing and the cache;
   this module only asks once and judges the answer.

   The judgement is strict because a wrong pin misleads more than a missing one. An answer is
   accepted only when OSM knows the exact building — its house number, street and city all
   agree with the vacancy's text. Two agreeing buildings far apart (the same number on two
   streets of one name) are refused unless the district written in the vacancy picks one. */

export type Geocoded =
  | { status: 'exact'; lat: number; lon: number; label: string }
  | { status: 'ambiguous' | 'none' };

type Place = {
  lat: string;
  lon: string;
  display_name: string;
  address: Record<string, string | undefined>;
};

const endpoint = 'https://nominatim.openstreetmap.org/search';
export const geocoderAgent = 'jobx.ge vacancy map (https://jobx.ge)';
/** Beyond this, two matching buildings are two places, not one building mapped twice. */
const sameBuildingMeters = 150;

/* Georgian and Latin letters mean the same thing in a house number: "60b" is "60ბ". */
const letters: Record<string, string> = {
  a: 'ა',
  b: 'ბ',
  g: 'გ',
  d: 'დ',
  e: 'ე',
  v: 'ვ',
};
export function houseKey(value: string) {
  const m = value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, '')
    .match(/^(\d{1,4})([ა-ჰa-z]?)/);
  if (!m) return '';
  return m[1] + (letters[m[2]] ?? m[2]);
}

function meters(a: Place, b: Place) {
  const rad = Math.PI / 180;
  const dLat = (Number(b.lat) - Number(a.lat)) * rad;
  const dLon = (Number(b.lon) - Number(a.lon)) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(Number(a.lat) * rad) *
      Math.cos(Number(b.lat) * rad) *
      Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

/** Whether an OSM answer is the building the vacancy names. */
export function matches(place: Place, address: StreetAddress) {
  const a = place.address;
  const city = a.city || a.town || a.village || a.municipality || '';
  const road = a.road || a.pedestrian || a.footway || a.square || '';
  return (
    !!a.house_number &&
    houseKey(a.house_number) === houseKey(address.number) &&
    road.includes(address.stem) &&
    city.includes(address.city)
  );
}

/** Picks the one building an answer list agrees on, or says why it cannot. */
export function judge(places: Place[], address: StreetAddress): Geocoded {
  let hits = places.filter((p) => matches(p, address));
  if (!hits.length) return { status: 'none' };
  const spread = (list: Place[]) =>
    Math.max(0, ...list.flatMap((p) => list.map((q) => meters(p, q))));
  if (spread(hits) > sameBuildingMeters && address.district) {
    const inDistrict = hits.filter((p) =>
      [
        p.address.suburb,
        p.address.city_district,
        p.address.neighbourhood,
        p.address.quarter,
      ]
        .filter(Boolean)
        .some((part) => part!.includes(address.district)),
    );
    if (inDistrict.length) hits = inDistrict;
  }
  if (spread(hits) > sameBuildingMeters) return { status: 'ambiguous' };
  const [first] = hits;
  return {
    status: 'exact',
    lat: Number(Number(first.lat).toFixed(6)),
    lon: Number(Number(first.lon).toFixed(6)),
    label: `${address.street} ${address.number}, ${address.city}`,
  };
}

export async function geocode(
  address: StreetAddress,
  fetcher: typeof fetch = fetch,
): Promise<Geocoded> {
  const url = new URL(endpoint);
  url.search = new URLSearchParams({
    q: address.query,
    format: 'jsonv2',
    addressdetails: '1',
    limit: '5',
    countrycodes: 'ge',
    'accept-language': 'ka',
  }).toString();
  const response = await fetcher(url, {
    headers: { 'User-Agent': geocoderAgent, Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Nominatim ${response.status}`);
  return judge((await response.json()) as Place[], address);
}
