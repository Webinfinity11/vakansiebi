import { categories } from './types';
import { cities } from './cities';
import { roleVocabulary } from './search-language';
import { latinUrl, legacyLatinUrl } from './latin-url';

const values: Record<string, readonly string[]> = {
  category: categories,
  city: cities,
  q: roleVocabulary.map((role) => role.label),
};

// Reviewed Latin city spellings share the existing Georgian landing page.
// They are URL aliases, not extra indexable keyword pages.
const cityAliases: Record<string, string> = {
  tbilisshi: 'თბილისი',
  tbilishi: 'თბილისი',
  tbilsi: 'თბილისი',
  batumshi: 'ბათუმი',
  qutaisshi: 'ქუთაისი',
  qutaisi: 'ქუთაისი',
  kutaisi: 'ქუთაისი',
  kutaisshi: 'ქუთაისი',
  rustavshi: 'რუსთავი',
};

// Old bookmarks and stored landing counts must keep resolving after a spelling fix.
const roleAliases: Record<string, string> = {
  dispecheri: 'დისპეტჩერი',
  დისპეჩერი: 'დისპეტჩერი',
};

export function searchUrlValue(key: string, value: string) {
  const label =
    key === 'q' && Object.hasOwn(roleAliases, value.toLowerCase())
      ? roleAliases[value.toLowerCase()]
      : value;
  return values[key]?.includes(label) ? latinUrl(label) : value;
}

export function searchValueFromUrl(key: string, value: string) {
  // "Tbilisi" and "tbilisi" are one address.
  const lower = value.toLowerCase();
  if (key === 'city' && Object.hasOwn(cityAliases, lower))
    return cityAliases[lower];
  if (key === 'q' && Object.hasOwn(roleAliases, lower))
    return roleAliases[lower];
  return (
    values[key]?.find((label) => latinUrl(label) === lower) ??
    values[key]?.find((label) => legacyLatinUrl(label) === lower) ??
    value
  );
}

export function canonicalSearchParams(params: URLSearchParams) {
  const next = new URLSearchParams(params);
  for (const key of Object.keys(values)) {
    const value = next.get(key);
    if (value !== null)
      next.set(key, searchUrlValue(key, searchValueFromUrl(key, value)));
  }
  return next;
}
