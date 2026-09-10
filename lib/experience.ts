import type { Vacancy } from './types';
// Shared by presentation and SQL filtering; a positive requirement beats an entry-level tag.
export const requiredExperiencePattern =
  'გამოცდილება\\s+(აუცილებელია|სავალდებულოა|მოითხოვება)|(?:უნდა|აუცილებელია)\\s+(?:ჰქონდეს|ქონდეს|გქონდეთ|ჰქონდეთ)\\s+(?:\\S+\\s+){0,5}გამოცდილება';
export function experienceConflict(
  job: Pick<Vacancy, 'description' | 'facts'>,
) {
  const fact = job.facts?.find(
    (item) =>
      /გამოცდილება/.test(item.label) &&
      /გამოცდილების გარეშე|გამოცდილებას არ აქვს მნიშვნელობა|არ არის (?:სავალდებულო|აუცილებელი)/.test(
        item.value,
      ),
  );
  if (!fact) return null;
  const requirement = job.description
    .split('\n')
    .map((line) => line.trim().replace(/^[•*–—-]+\s*/, ''))
    .find((line) => new RegExp(requiredExperiencePattern, 'i').test(line));
  return requirement ? { field: fact.value, requirement } : null;
}
