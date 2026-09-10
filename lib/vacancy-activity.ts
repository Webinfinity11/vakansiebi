export type VacancyActivity = {
  seen: string[];
  hidden: { id: string; title: string }[];
};
const uuid = /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i;
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
    };
  } catch {
    return { seen: [], hidden: [] };
  }
}
