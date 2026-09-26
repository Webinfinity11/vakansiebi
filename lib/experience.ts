import type { Vacancy } from './types';
// Shared by presentation and SQL filtering; a positive requirement beats an entry-level tag.
export const requiredExperiencePattern =
  'გამოცდილება\\s+(აუცილებელია|სავალდებულოა|მოითხოვება)|(?:უნდა|აუცილებელია)\\s+(?:ჰქონდეს|ქონდეს|გქონდეთ|ჰქონდეთ)\\s+(?:\\S+\\s+){0,5}გამოცდილება';
/* "არ უნდა ჰქონდეს გამოცდილება" reads like a requirement to the pattern above; the
   negation is removed before the requirement is looked for. */
export const negatedRequirement =
  'არ\\s+(?:უნდა|არის\\s+აუცილებელი|არის\\s+სავალდებულო)';
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
    .find((line) =>
      new RegExp(requiredExperiencePattern, 'i').test(
        line.replace(new RegExp(negatedRequirement, 'g'), ''),
      ),
    );
  return requirement ? { field: fact.value, requirement } : null;
}
