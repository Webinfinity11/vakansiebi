/* Distances on the ground, and how long they take on foot.

   Straight-line distance undercounts a walk: streets bend and blocks have to be walked around.
   1.25 is the usual detour factor for a city grid, and 80 m a minute (4.8 km/h) an ordinary
   walking pace, so "10 minutes" means about 640 m as the crow flies. */

const earthRadius = 6_371_008.8;
export const walkDetour = 1.25;
export const walkMetersPerMinute = 80;

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in meters (haversine). */
export function distanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) {
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Whole minutes on foot, rounded up; a place at the door is still one minute away. */
export function walkMinutes(meters: number) {
  return Math.max(
    1,
    Math.ceil((meters * walkDetour) / walkMetersPerMinute - 1e-9),
  );
}

/** The straight-line distance that a walk of `minutes` covers. */
export function walkReachMeters(minutes: number) {
  return (minutes * walkMetersPerMinute) / walkDetour;
}

/** "350 მ" under a kilometre (to the nearest 10 m), "1,2 კმ" above it. */
export function formatDistance(meters: number) {
  if (meters < 995) return `${Math.max(10, Math.round(meters / 10) * 10)} მ`;
  return `${(meters / 1000).toFixed(1).replace('.', ',')} კმ`;
}

export function formatWalk(minutes: number) {
  return `${minutes} წთ ფეხით`;
}

/** A circle on the map as a GeoJSON ring of `steps` points around [lon, lat]. */
export function circleRing(
  lat: number,
  lon: number,
  meters: number,
  steps = 64,
): [number, number][] {
  const dLat = (meters / earthRadius) * (180 / Math.PI);
  const dLon = dLat / Math.cos(rad(lat));
  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * 2 * Math.PI;
    ring.push([lon + dLon * Math.cos(t), lat + dLat * Math.sin(t)]);
  }
  return ring;
}
