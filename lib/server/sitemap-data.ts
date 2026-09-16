import { db } from './db';
import { searchPlan } from './search-plan';

export type DatedVacancy = { id: string; lastModified: Date };

let held: { at: number; value: Promise<DatedVacancy[]> } | null = null;

/* Every public vacancy with the time its record last changed. The vacancy and company
   sitemaps share this list, so a server builds it once every five minutes. */
export function publicVacancyDates(now = Date.now()) {
  if (held && now - held.at < 300_000) return held.value;
  const plan = searchPlan(new URLSearchParams(), false, { grouped: true });
  const value = db()
    .query<{ id: string; modified: Date }>(
      `${plan.cte} SELECT j.id,COALESCE(record.updated_at,j.published_at,j.created_at) AS modified FROM searchable j JOIN jobs record ON record.id=j.id WHERE ${plan.where} ORDER BY ${plan.ordering},j.id LIMIT 45000`,
      plan.args,
    )
    .then((result) =>
      result.rows.map((r) => ({
        id: r.id,
        lastModified: new Date(r.modified),
      })),
    );
  held = { at: now, value };
  // A failed build is not held, so the next crawler request tries again.
  value.catch(() => {
    if (held?.value === value) held = null;
  });
  return value;
}

export function newest(dates: Iterable<Date>) {
  let latest: Date | undefined;
  for (const date of dates) if (!latest || date > latest) latest = date;
  return latest;
}
