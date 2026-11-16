import {
  contacts,
  vacancyEventKinds,
  type VacancyAnalytics,
  type VacancyDay,
  type VacancyEventKind,
} from './vacancy-analytics';

export type CompanyJobStats = VacancyAnalytics & {
  id: string;
  publishedAt: string;
  series: VacancyDay[];
};

/** What each counted reader action means, in the words an employer uses. */
export const actionLabels: Record<Exclude<VacancyEventKind, 'view'>, string> = {
  cv: 'CV-ის გაგზავნა',
  call: 'დარეკვა',
  email: 'ელფოსტით მიწერა',
  apply: 'განაცხადის ბმულის გახსნა',
  outbound: 'სხვა ბმულზე გადასვლა',
  save: 'შენახვა',
};

export const emptyCounts = () =>
  Object.fromEntries(vacancyEventKinds.map((k) => [k, 0])) as Record<
    VacancyEventKind,
    number
  >;

export function sumCounts(list: Record<VacancyEventKind, number>[]) {
  const out = emptyCounts();
  for (const c of list) for (const k of vacancyEventKinds) out[k] += c[k];
  return out;
}

/** Per-day totals across several vacancies; every series covers the same 30 days. */
export function sumSeries(list: VacancyDay[][]) {
  if (!list.length) return [];
  return list[0].map((d, i) => {
    const day = { ...d };
    for (const s of list.slice(1))
      for (const k of vacancyEventKinds) day[k] += s[i][k];
    return day;
  });
}

/** Sum of the last `n` days of a series, optionally ending `skip` days earlier. */
export function windowCounts(series: VacancyDay[], n: number, skip = 0) {
  const end = series.length - skip;
  return sumCounts(series.slice(Math.max(0, end - n), end));
}

export { contacts };

/** Share of views that ended in an attempt to reach the employer, or null without views. */
export function contactRate(c: Record<VacancyEventKind, number>) {
  return c.view ? contacts(c) / c.view : null;
}
