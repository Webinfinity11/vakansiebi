import type { MapVacancy } from './server/job-map';
import { distanceMeters } from './geo';
import { textSearch } from './search-text';

export type NearbyPoint = { lat: number; lon: number };

/** Filter individual workplaces too: a matching branch must not expose unrelated pins. */
export function filterMapVacancies(
  list: MapVacancy[],
  options: {
    query: string;
    area: string;
    category: string;
    paid: boolean;
    near?: NearbyPoint | null;
    radius?: number;
  },
) {
  const matchesRole = textSearch(options.query);
  const matchesArea = textSearch(options.area);
  return list.flatMap((v) => {
    if (
      !matchesRole(`${v.title} ${v.company}`) ||
      (options.category && v.category !== options.category) ||
      (options.paid && !v.salary)
    )
      return [];
    const places = v.places.filter(
      ([lat, lon, label]) =>
        matchesArea(`${label} ${v.placeDistricts?.[label] || ''}`) &&
        (!options.near ||
          distanceMeters(options.near.lat, options.near.lon, lat, lon) <=
            (options.radius ?? 1000)),
    );
    return places.length ? [{ ...v, places }] : [];
  });
}
