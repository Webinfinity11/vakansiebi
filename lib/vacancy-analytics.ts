export const vacancyEventKinds = [
  'view',
  'outbound',
  'call',
  'cv',
  'apply',
  'save',
] as const;
export type VacancyEventKind = (typeof vacancyEventKinds)[number];
export type VacancyAnalytics = {
  total: Record<VacancyEventKind, number>;
  last7: Record<VacancyEventKind, number>;
};
export type VacancyAnalyticsRow = {
  value: string;
  kind: VacancyEventKind;
  total: number | string;
  last7: number | string;
};

/** Combines raw and daily counts and includes zeroes for vacancies with no events. */
export function aggregateVacancyAnalytics(
  ids: string[],
  rows: VacancyAnalyticsRow[],
) {
  const empty = () =>
    Object.fromEntries(vacancyEventKinds.map((kind) => [kind, 0])) as Record<
      VacancyEventKind,
      number
    >;
  const result: Record<string, VacancyAnalytics> = Object.fromEntries(
    ids.map((id) => [id, { total: empty(), last7: empty() }]),
  );
  for (const row of rows) {
    const counts = result[row.value];
    if (!counts || !vacancyEventKinds.includes(row.kind)) continue;
    counts.total[row.kind] += Number(row.total);
    counts.last7[row.kind] += Number(row.last7);
  }
  return result;
}
