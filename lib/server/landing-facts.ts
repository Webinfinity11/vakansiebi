import { db } from './db';
import { searchPlan } from './search-plan';
import { employerPages } from './employers';
import type { Landing } from '../seo-landing';
import type { LandingFacts } from '../landing-facts';

/* What a landing page's own list adds up to: how much of it is new this week,
   what it pays where the pay is stated, and who hires the most. Read from the
   same canonical rows and filters as the list, so the numbers describe it. */
async function loadLandingFacts(landing: Landing): Promise<LandingFacts> {
  const params = new URLSearchParams(landing.path.split('?')[1] || '');
  const plan = searchPlan(params, false, { grouped: true, pricing: true });
  const daily = params.get('salaryPeriod') === 'day';
  const salary = daily ? 'j.salary_day' : 'j.salary_month';
  const [{ rows }, employers] = await Promise.all([
    db().query<{ id: string; fresh: boolean; pay: string | null }>(
      `${plan.cte} SELECT j.id,j.posted_on>=to_char((now() AT TIME ZONE 'Asia/Tbilisi')::date-6,'YYYY-MM-DD') AS fresh,CASE WHEN ${salary}>0 THEN ${salary} END AS pay FROM searchable j WHERE ${plan.where}`,
      plan.args,
    ),
    // Held for half an hour and shared with every company and vacancy page.
    employerPages().catch(() => null),
  ]);
  const pays = rows
    .map((row) => Number(row.pay))
    .filter((pay) => pay > 0)
    .sort((a, b) => a - b);
  const quantile = (q: number) => {
    const at = (pays.length - 1) * q;
    const low = Math.floor(at);
    return Math.round(
      pays[low] + (pays[low + 1] - pays[low] || 0) * (at - low),
    );
  };
  const hiring = new Map<string, number>();
  if (employers)
    for (const row of rows) {
      const slug = employers.byJob.get(row.id);
      if (slug) hiring.set(slug, (hiring.get(slug) ?? 0) + 1);
    }
  return {
    total: rows.length,
    fresh: rows.filter((row) => row.fresh).length,
    // Fewer than eight stated figures is an anecdote, not a range.
    salary:
      pays.length >= 8
        ? {
            period: daily ? 'day' : 'month',
            count: pays.length,
            low: quantile(0.25),
            median: quantile(0.5),
            high: quantile(0.75),
          }
        : null,
    // One vacancy is not "hiring the most"; two at least, as a company page needs.
    employers: [...hiring]
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 5)
      .map(([slug, count]) => ({
        slug,
        name: employers!.bySlug.get(slug)!.name,
        count,
      })),
  };
}

const factsTtl = 30 * 60_000;
const held = new Map<string, { at: number; value: Promise<LandingFacts> }>();
export function landingFacts(landing: Landing, now = Date.now()) {
  const existing = held.get(landing.path);
  if (existing && now - existing.at < factsTtl) return existing.value;
  while (held.size >= 600) held.delete(held.keys().next().value!);
  const value = loadLandingFacts(landing);
  held.set(landing.path, { at: now, value });
  value.catch(() => {
    if (held.get(landing.path)?.value === value) held.delete(landing.path);
  });
  return value;
}
