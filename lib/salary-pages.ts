import { categories } from './types';
import { subcategories } from './subcategories';
import { roleVocabulary } from './search-language';
import { searchUrlValue } from './search-url';
import { textSearch } from './search-text';

type SalaryDefinition = {
  label: string;
  genitive: string;
  slug: string;
  group: string;
  kind: 'legacy' | 'category' | 'profession';
  href: string;
  pattern?: string;
};
// The public salary explorer uses exactly the catalogue's categories and role rules.
// Existing profession URLs remain valid for bookmarks and search engines.
export const salaryRoles: SalaryDefinition[] = [
  ...roleVocabulary.map((role) => ({
    ...role,
    slug: searchUrlValue('q', role.label),
    group: '',
    kind: 'legacy' as const,
    href: `/?q=${searchUrlValue('q', role.label)}`,
  })),
  ...categories.map((category) => ({
    label: category,
    genitive: category,
    group: category,
    slug: `category-${searchUrlValue('category', category)}`,
    kind: 'category' as const,
    href: `/?category=${searchUrlValue('category', category)}`,
  })),
  ...subcategories.map((role) => ({
    label: role.label,
    genitive: role.label,
    group: role.category,
    slug: role.id,
    kind: 'profession' as const,
    pattern: role.pattern,
    href: `/?category=${searchUrlValue('category', role.category)}&subcategory=${role.id}`,
  })),
];
export type SalarySample = {
  count: number;
  low: number;
  median: number;
  high: number;
};
export type SalaryRole = (typeof salaryRoles)[number] & {
  total: number;
  month: SalarySample | null;
  day: SalarySample | null;
};
export function salarySample(
  values: (number | string | null)[],
): SalarySample | null {
  const sorted = values
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
  if (sorted.length < 8) return null;
  const at = (q: number) => {
    const n = (sorted.length - 1) * q,
      lo = Math.floor(n),
      hi = Math.ceil(n);
    return Math.round(sorted[lo] + (sorted[hi] - sorted[lo]) * (n - lo));
  };
  return {
    count: sorted.length,
    low: at(0.25),
    median: at(0.5),
    high: at(0.75),
  };
}
export function summarizeSalaries(
  rows: {
    title: string;
    category?: string;
    month: number | string | null;
    day: number | string | null;
  }[],
): SalaryRole[] {
  return salaryRoles.map((role) => {
    const match =
      role.kind === 'legacy'
        ? textSearch(role.label)
        : role.pattern
          ? (title: string) =>
              new RegExp(role.pattern!, 'i').test(
                title.normalize('NFKC').toLowerCase(),
              )
          : () => true;
    const jobs = rows.filter(
      (row) =>
        (role.kind === 'legacy' || row.category === role.group) &&
        match(row.title),
    );
    return {
      ...role,
      total: jobs.length,
      month: salarySample(jobs.map((row) => row.month)),
      day: salarySample(jobs.map((row) => row.day)),
    };
  });
}
