import { categories } from './types';
import { cities } from './cities';
import { roleVocabulary } from './search-language';
import { latinUrl } from './latin-url';

const values: Record<string, readonly string[]> = {
  category: categories,
  city: cities,
  q: roleVocabulary.map((role) => role.label),
};

export function searchUrlValue(key: string, value: string) {
  return values[key]?.includes(value) ? latinUrl(value) : value;
}

export function searchValueFromUrl(key: string, value: string) {
  // "Tbilisi" and "tbilisi" are one address.
  const lower = value.toLowerCase();
  return values[key]?.find((label) => latinUrl(label) === lower) ?? value;
}

export function canonicalSearchParams(params: URLSearchParams) {
  const next = new URLSearchParams(params);
  for (const key of Object.keys(values)) {
    const value = next.get(key);
    if (value !== null) next.set(key, searchUrlValue(key, value));
  }
  return next;
}
