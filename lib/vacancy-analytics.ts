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

/* Anything that means a visitor tried to reach the employer. A save is interest, not contact. */
export const contactKinds = ['apply', 'call', 'cv', 'outbound'] as const;
export const seriesDays = 30;
export type VacancyDay = { day: string } & Record<VacancyEventKind, number>;
export type VacancySeriesRow = {
  value: string;
  kind: VacancyEventKind;
  day: string;
  count: number | string;
};

export function contacts(counts: Record<VacancyEventKind, number>) {
  return contactKinds.reduce((sum, kind) => sum + counts[kind], 0);
}

/** One entry per calendar day from `first` to `last` inclusive, so empty days read as zero. */
export function vacancySeries(
  ids: string[],
  rows: VacancySeriesRow[],
  first: string,
  last: string,
) {
  const days: string[] = [];
  const end = Date.parse(`${last}T00:00:00Z`);
  for (let t = Date.parse(`${first}T00:00:00Z`); t <= end; t += 86400000)
    days.push(new Date(t).toISOString().slice(0, 10));
  const result: Record<string, VacancyDay[]> = Object.fromEntries(
    ids.map((id) => [
      id,
      days.map(
        (day) =>
          ({
            day,
            ...Object.fromEntries(vacancyEventKinds.map((kind) => [kind, 0])),
          }) as VacancyDay,
      ),
    ]),
  );
  for (const row of rows) {
    const i = days.indexOf(row.day);
    const series = result[row.value];
    if (i < 0 || !series || !vacancyEventKinds.includes(row.kind)) continue;
    series[i][row.kind] += Number(row.count);
  }
  return result;
}

/** A JOBX-built CV whose holder pressed a contact button on one of our vacancies. */
export type ResumeContact = {
  resumeId: string;
  fullName: string;
  title: string;
  phone: string;
  email: string;
  city: string;
  kinds: { kind: 'cv' | 'call' | 'apply'; presses: number }[];
  firstAt: string;
  lastAt: string;
};
