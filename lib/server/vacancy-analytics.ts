import { db } from './db';
import {
  aggregateVacancyAnalytics,
  seriesDays,
  vacancyEventKinds,
  vacancySeries,
  type VacancyAnalyticsRow,
  type VacancySeriesRow,
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

/* Daily counts for the last thirty Tbilisi days. Raw events are folded into the daily table
   once they are thirty days old, so the oldest day can sit partly in each; both are read. */
export async function vacancyDailySeries(ids: string[]) {
  if (!ids.length) return {};
  const tbilisi = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tbilisi',
  });
  const last = tbilisi.format(new Date());
  const start = new Date(`${last}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - (seriesDays - 1));
  const first = start.toISOString().slice(0, 10);
  const { rows } = await db().query<VacancySeriesRow>(
    `SELECT value, kind, day::text, sum(count) AS count FROM (
       SELECT value, kind, (created_at AT TIME ZONE 'Asia/Tbilisi')::date AS day, count(*) AS count
       FROM analytics_events
       WHERE value = ANY($1::text[]) AND kind = ANY($2::text[])
         AND created_at >= $3::date::timestamp AT TIME ZONE 'Asia/Tbilisi'
       GROUP BY 1,2,3
       UNION ALL
       SELECT value, kind, day, count FROM analytics_daily
       WHERE value = ANY($1::text[]) AND kind = ANY($2::text[]) AND day >= $3::date
     ) counted GROUP BY 1,2,3`,
    [ids, vacancyEventKinds, first],
  );
  return vacancySeries(ids, rows, first, last);
}

/* Every real vacancy sent through JOBX's own posting form that has been on the site, newest
   first, with its counts. Tests and never-published submissions have nothing to measure. */
export async function submissionPerformance() {
  const { rows: jobs } = await db().query<{
    id: string;
    title: string | null;
    company: string | null;
    status: string;
    tier: string;
    placementExpiresAt: string | null;
    publishedAt: string | null;
    submittedAt: string;
  }>(
    `SELECT j.id::text id, coalesce(j.published->>'title', j.draft->>'title') title,
       coalesce(j.published->>'company', j.draft->>'company') company, j.status,
       CASE WHEN j.placement_expires_at > now() THEN j.placement_tier ELSE 'standard' END tier,
       j.placement_expires_at "placementExpiresAt", j.published_at "publishedAt", s.created_at "submittedAt"
     FROM job_submissions s JOIN jobs j ON j.id = s.job_id
     WHERE NOT s.is_test AND j.published_at IS NOT NULL
     ORDER BY s.created_at DESC LIMIT 200`,
  );
  const ids = jobs.map((j) => j.id);
  const [counts, series] = await Promise.all([
    vacancyAnalytics(ids),
    vacancyDailySeries(ids),
  ]);
  return jobs.map((j) => ({
    ...j,
    ...counts[j.id],
    series: series[j.id],
  }));
}
