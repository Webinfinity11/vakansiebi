import type { Vacancy } from './types';

export function searchTerms(query: string): string[] {
  return [
    ...new Set(
      query
        .normalize('NFKC')
        .toLowerCase()
        .match(/[\p{L}\p{N}+#.]+/gu) || [],
    ),
  ].slice(0, 12);
}
const text = (value: string) =>
  value.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
// Only identical posting cycles and content can be linked automatically.
// Similar titles alone are deliberately insufficient evidence.
const entries = (values: unknown) =>
  JSON.stringify(
    Array.isArray(values)
      ? values.map((value) => JSON.stringify(value)).sort()
      : [],
  );
export function samePosting(a: Vacancy, b: Vacancy): boolean {
  if (
    !a.company.trim() ||
    !a.city.trim() ||
    !a.datePosted ||
    !a.deadline ||
    a.description.length < 80
  )
    return false;
  return (
    (
      [
        'title',
        'company',
        'city',
        'description',
        'datePosted',
        'deadline',
        'salary',
        'currency',
        'salaryPeriod',
        'mode',
        'employmentType',
      ] as const
    ).every((key) => text(a[key] || '') === text(b[key] || '')) &&
    a.salaryMin === b.salaryMin &&
    entries(a.facts) === entries(b.facts) &&
    entries(a.applicationLinks) === entries(b.applicationLinks)
  );
}
export type SourceHealth = 'recent' | 'stale' | 'unavailable' | 'unknown';
export function sourceHealth(
  checked: string | null,
  error: string | null,
  now = Date.now(),
): SourceHealth {
  if (error) return 'unavailable';
  const at = checked ? Date.parse(checked) : NaN;
  if (!Number.isFinite(at) || at > now + 60000) return 'unknown';
  return now - at <= 48 * 3600000 ? 'recent' : 'stale';
}
