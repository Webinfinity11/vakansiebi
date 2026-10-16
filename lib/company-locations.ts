import { jobsLocation } from '../worker/adapters/jobs-location';
import { mapCities } from './street-address';
import { workTowns } from './work-location';

const towns = new Set([...workTowns, ...mapCities]);

/** Source location fields can contain a department or branch name. Only towns belong
 * in a city picker; an unrecognized location still stays in the unfiltered job list. */
export function companyLocationNames(raw: string): string[] {
  return [
    ...new Set(
      raw.split(/[,;/]|\s+და\s+/u).flatMap((part) => {
        const { city } = jobsLocation(part, false);
        return towns.has(city) ? [city] : [];
      }),
    ),
  ];
}
