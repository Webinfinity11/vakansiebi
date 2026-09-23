import { db } from './db';
import {
  aggregateVacancyAnalytics,
  vacancyEventKinds,
  type VacancyAnalyticsRow,
} from '../vacancy-analytics';

export async function vacancyAnalytics(ids: string[]) {
  if (!ids.length) return {};
  // Read both tables in one snapshot: rollup atomically moves rows between them.
  // Do not restrict raw totals to 30 days: the worker may not have folded them yet.
  const { rows } = await db().query<VacancyAnalyticsRow>(
    `SELECT value,kind,count(*) AS total,
       count(*) FILTER (WHERE created_at >= now() - interval '7 days') AS last7
     FROM analytics_events WHERE value = ANY($1::text[]) AND kind = ANY($2::text[])
     GROUP BY value,kind
     UNION ALL
     SELECT value,kind,sum(count) AS total,0 AS last7
     FROM analytics_daily WHERE value = ANY($1::text[]) AND kind = ANY($2::text[])
     GROUP BY value,kind`,
    [ids, vacancyEventKinds],
  );
  return aggregateVacancyAnalytics(ids, rows);
}
