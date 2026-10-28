import { employerKey } from './employer-identity';
import { genericCompanyKeys } from './company-logo-identity';

export function removalCompanyNames(text: string) {
  return text
    .split(/\r?\n/)
    .map((name) => name.trim())
    .filter(Boolean);
}

export function removalCompanyKeys(names: string[]) {
  const baseKeys = [...new Set(names.map(employerKey))].filter(
    (key) => key.length >= 3 && !genericCompanyKeys.has(key),
  );
  const legalForms = [
    'შპს',
    'სს',
    'სსიპ',
    'ააიპ',
    'იმ',
    'llc',
    'ltd',
    'jsc',
    'inc',
  ];
  return [
    ...new Set(
      baseKeys.flatMap((key) => [
        key,
        ...legalForms.flatMap((form) => [
          (form + key).slice(0, 300),
          (key + form).slice(0, 300),
        ]),
      ]),
    ),
  ];
}

export type RemovalPreview = {
  companies: { name: string; published: number; total: number }[];
  published: number;
  total: number;
};
