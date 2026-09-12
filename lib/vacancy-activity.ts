export type RecentVacancy = {
  id: string;
  title: string;
  company: string;
  at: number;
};
export type VacancyActivity = {
  seen: string[];
  hidden: { id: string; title: string }[];
  recent: RecentVacancy[];
};
const uuid = /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i;
export const recentLimit = 12;
export function readActivity(raw: string | null): VacancyActivity {
  try {
    const value = JSON.parse(raw || 'null');
    return {
      seen: [
        ...new Set<string>(
          Array.isArray(value?.seen)
            ? value.seen.filter(
                (id: unknown) => typeof id === 'string' && uuid.test(id),
              )
            : [],
        ),
      ].slice(-500),
      hidden: Array.isArray(value?.hidden)
        ? value.hidden
            .filter(
              (
                item: { id?: unknown; title?: unknown },
                index: number,
                all: { id?: unknown }[],
              ) =>
                item &&
                typeof item.id === 'string' &&
                uuid.test(item.id) &&
                typeof item.title === 'string' &&
                all.findIndex((x) => x?.id === item.id) === index,
            )
            .slice(-100)
            .map((item: { id: string; title: string }) => ({
              id: item.id,
              title: item.title.slice(0, 180),
            }))
        : [],
      // Stored objects written before this field existed have no `recent`; that is an empty strip.
      recent: Array.isArray(value?.recent)
        ? value.recent
            .filter(
              (
                item: {
                  id?: unknown;
                  title?: unknown;
                  company?: unknown;
                  at?: unknown;
                },
                index: number,
                all: { id?: unknown }[],
              ) =>
                item &&
                typeof item.id === 'string' &&
                uuid.test(item.id) &&
                typeof item.title === 'string' &&
                typeof item.at === 'number' &&
                Number.isFinite(item.at) &&
                all.findIndex((x) => x?.id === item.id) === index,
            )
            .slice(0, recentLimit)
            .map(
              (item: {
                id: string;
                title: string;
                company?: unknown;
                at: number;
              }) => ({
                id: item.id,
                title: item.title.slice(0, 180),
                company:
                  typeof item.company === 'string'
                    ? item.company.slice(0, 120)
                    : '',
                at: item.at,
              }),
            )
        : [],
    };
  } catch {
    return { seen: [], hidden: [], recent: [] };
  }
}
