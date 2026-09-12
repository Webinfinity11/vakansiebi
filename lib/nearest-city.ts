import { cities } from './cities';
/* Approximate centres of the cities offered as filter options. Used only to pick the closest
   option to a device position; nothing here is precise enough for anything else. */
const centres: Record<(typeof cities)[number], [number, number]> = {
  თბილისი: [41.7151, 44.8271],
  ბათუმი: [41.6168, 41.6367],
  ქუთაისი: [42.2679, 42.718],
  რუსთავი: [41.5495, 44.9932],
  გორი: [41.9842, 44.1158],
  ზუგდიდი: [42.5088, 41.8709],
  ფოთი: [42.1462, 41.6719],
  თელავი: [41.9198, 45.4731],
  კასპი: [41.9254, 44.4189],
  მცხეთა: [41.8454, 44.7196],
  ახალციხე: [41.6392, 42.9826],
  ბორჯომი: [41.8404, 43.3894],
  ოზურგეთი: [41.9244, 42.0066],
};
const earthKm = 6371;
const rad = (deg: number) => (deg * Math.PI) / 180;
export function distanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
) {
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * earthKm * Math.asin(Math.sqrt(a));
}
/** The listed city closest to a position and how far it is; always answers, even far away. */
export function nearestCity(lat: number, lng: number) {
  let best = { city: cities[0] as string, km: Infinity };
  for (const city of cities) {
    const [clat, clng] = centres[city];
    const km = distanceKm(lat, lng, clat, clng);
    if (km < best.km) best = { city, km };
  }
  return best;
}
