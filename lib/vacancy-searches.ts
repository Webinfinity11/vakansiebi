import { cities, cityNamePattern } from './cities';
import { escapeRegex } from './job-intelligence';
import { roleVocabulary, syncopeVariant } from './search-language';
import {
  eligibleLandings,
  landingHeading,
  landingPath,
  type LandingCount,
} from './seo-landing';
import type { Vacancy } from './types';

/** Related searches must describe this posting and lead to populated pages. */
export function vacancySearches(
  job: Pick<Vacancy, 'title' | 'category' | 'city'>,
  rows: readonly LandingCount[],
) {
  const title = job.title.normalize('NFKC').toLowerCase();
  const place = job.city.normalize('NFKC').toLowerCase();
  const towns = cities.filter((city) =>
    new RegExp(`(?<![\\p{L}])${cityNamePattern(city)}(?![\\p{L}])`, 'u').test(
      place,
    ),
  );
  const available = new Map(
    eligibleLandings(rows).map((row) => [landingPath(row), row]),
  );
  const availableRoles = new Set(
    [...available.values()].map((row) => row.role),
  );
  // Only an occupation in the title: descriptions can mention colleagues or
  // past experience. A compound role takes precedence over its generic suffix.
  const role = roleVocabulary
    .map(({ stem, label }) => {
      const stems = [stem, syncopeVariant(stem)].filter(Boolean) as string[];
      const match = title.match(
        new RegExp(
          `(?<![\\p{L}])(?:${stems.map(escapeRegex).join('|')})[ა-ჰ]*(?![\\p{L}])`,
          'u',
        ),
      );
      return { label, at: match?.index ?? -1, words: stem.split(' ').length };
    })
    .filter(({ at, label }) => at >= 0 && availableRoles.has(label))
    .sort((a, b) => b.words - a.words || a.at - b.at)[0]?.label;
  const choices: Omit<LandingCount, 'count'>[] = [];
  const add = (
    category: string | null,
    city: string | null,
    profession: string | null = null,
  ) => choices.push({ category, city, role: profession, trait: null });
  if (role) {
    // A multi-city posting should not arbitrarily choose one workplace.
    if (towns.length === 1) add(null, towns[0], role);
    add(null, null, role);
  }
  if (towns.length === 1) add(job.category, towns[0]);
  add(job.category, null);
  for (const city of towns) add(null, city);
  return [...new Set(choices.map(landingPath))]
    .flatMap((path) => {
      const row = available.get(path);
      return row
        ? [{ path, label: landingHeading(row).replace(' საქართველოში', '') }]
        : [];
    })
    .slice(0, 6);
}
