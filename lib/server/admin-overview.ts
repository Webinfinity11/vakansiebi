import { db } from './db';

export const overviewPeriods = [1, 7, 30] as const;
export type OverviewPeriod = (typeof overviewPeriods)[number];

/* The numbers the admin opens on, each for the chosen window and the window before it, plus
   fourteen days of history for the small trend lines. Everything is read from small tables or
   narrow indexes: new vacancies come from the scraper runs rather than a count over jobs, and
   archiving from a partial index on the audit log. Test submissions count nowhere. */
export async function adminOverview(days: OverviewPeriod) {
  const window = `${days} days`;
  const [imported, series, archived, submissions, revenue] = await Promise.all([
    db().query(
      `SELECT
         coalesce(sum(imported) FILTER (WHERE finished_at > now() - $1::interval), 0)::int now,
         coalesce(sum(imported) FILTER (WHERE finished_at <= now() - $1::interval), 0)::int before
       FROM source_runs WHERE finished_at > now() - 2 * $1::interval`,
      [window],
    ),
    db().query(
      `SELECT (finished_at AT TIME ZONE 'Asia/Tbilisi')::date::text AS day, sum(imported)::int AS count
       FROM source_runs WHERE finished_at > now() - interval '14 days'
       GROUP BY 1 ORDER BY 1`,
    ),
    db().query(
      `SELECT
         count(*) FILTER (WHERE created_at > now() - $1::interval)::int now,
         count(*) FILTER (WHERE created_at <= now() - $1::interval)::int before,
         count(*) FILTER (WHERE created_at > now() - $1::interval AND after_data->>'reason' = 'expired')::int expired,
         count(*) FILTER (WHERE created_at > now() - $1::interval AND after_data->>'reason' = 'removed')::int removed
       FROM audit_log
       WHERE action = 'automation.archived' AND created_at > now() - 2 * $1::interval`,
      [window],
    ),
    db().query(
      `SELECT
         count(*) FILTER (WHERE s.created_at > now() - $1::interval)::int now,
         count(*) FILTER (WHERE s.created_at <= now() - $1::interval
           AND s.created_at > now() - 2 * $1::interval)::int before,
         count(*) FILTER (WHERE j.status = 'pending')::int waiting
       FROM job_submissions s JOIN jobs j ON j.id = s.job_id
       WHERE NOT s.is_test`,
      [window],
    ),
    db().query(
      `SELECT
         coalesce(sum(i.amount_gel) FILTER (WHERE i.paid_at > now() - $1::interval), 0)::int now,
         coalesce(sum(i.amount_gel) FILTER (WHERE i.paid_at <= now() - $1::interval
           AND i.paid_at > now() - 2 * $1::interval), 0)::int before,
         coalesce(sum(i.amount_gel) FILTER (WHERE i.status = 'pending'), 0)::int awaiting
       FROM job_invoices i
       WHERE i.status IN ('paid', 'pending')
         AND NOT EXISTS (SELECT 1 FROM job_submissions s WHERE s.job_id = i.job_id AND s.is_test)`,
      [window],
    ),
  ]);
  return {
    days,
    imported: { ...imported.rows[0], series: series.rows },
    archived: archived.rows[0],
    submissions: submissions.rows[0],
    revenue: revenue.rows[0],
  };
}
