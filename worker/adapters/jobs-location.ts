import { cities } from '../../lib/cities';
import { workTowns } from '../../lib/work-location';
import {
  mapCities,
  streetAddresses,
  tbilisiDistricts,
} from '../../lib/street-address';
import { metroStations } from '../../lib/tbilisi-metro';

/*
 * jobs.ge's "location" is free text: a town, but often a Tbilisi district, a metro station or a
 * street. Stored as the city, those fall out of the Tbilisi filter and count as "other".
 */
export type JobsLocation = {
  city: string;
  /** Set only for a remote posting. */
  mode?: 'დისტანციური';
  /** The original text, kept when the city was read out of it. */
  address?: string;
};

const towns = [...new Set<string>([...cities, ...workTowns, ...mapCities])];
const boundary = (pattern: string) =>
  new RegExp(`(?<![\\p{L}\\p{N}-])(?:${pattern})(?![\\p{L}\\p{N}-])`, 'iu');
const townPatterns = towns.map((town) => ({
  town,
  re: boundary(
    town.endsWith('ი') ? town.slice(0, -1) + '(?:ი|ში|ის)' : town + '(?:ში|ს)?',
  ),
}));
const districtPatterns = tbilisiDistricts.map((d) =>
  boundary(d.endsWith('ი') ? d.slice(0, -1) + '(?:ი|ში|ზე)' : d + '(?:ში|ზე)?'),
);
const stationPatterns = [
  ...new Set(metroStations.map((s) => s.name.replace(/-\d$/, ''))),
].map((name) =>
  boundary(
    name.endsWith('ი')
      ? `${name}|${name.slice(0, -1)}(?:თან|ზე)`
      : `${name}(?:სთან|ზე)?`,
  ),
);

export function jobsLocation(raw: string): JobsLocation {
  const text = raw
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s*[;.]+$/, '')
    .trim();
  if (!text) return { city: '' };
  if (/^დისტანციურ(?:ად|ი)$/i.test(text))
    return { city: '', mode: 'დისტანციური' };
  const named = townPatterns.filter((t) => t.re.test(text)).map((t) => t.town);
  const withAddress = (city: string): JobsLocation =>
    city === text ? { city } : { city, address: text };
  // Several towns without saying which is where: keep the text as the source wrote it.
  if (named.length > 1) return { city: text };
  if (named.length === 1) return withAddress(named[0]);
  if (
    districtPatterns.some((re) => re.test(text)) ||
    stationPatterns.some((re) => re.test(text))
  )
    return withAddress('თბილისი');
  // A street with a house number and no town named: jobs.ge is a Tbilisi board.
  const streets = streetAddresses(text, 'თბილისი');
  if (streets.length && streets.every((s) => s.city === 'თბილისი'))
    return withAddress('თბილისი');
  return { city: text };
}
