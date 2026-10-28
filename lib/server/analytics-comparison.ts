import { db } from './db';
import { contactKinds } from '../vacancy-analytics';
import type {
  AnalyticsComparison,
  ComparisonMetrics,
} from '../analytics-comparison';

/** Daily rollups cannot recover a partial historical day. For multi-day windows,
 * compare only the complete days inside the selection, shifted by its width.
 * Today/yesterday remain within raw-event retention and can match the exact time.
 * All compared metrics are read in one SQL snapshot; no second full report scan. */
export async function analyticsComparison(
  params: string[],
  period: number | 'today' | 'yesterday',
): Promise<AnalyticsComparison> {
  const days = typeof period === 'number' ? period : 1;
  const completedDays = days > 1;
  const rows = (
    await db().query(
      `WITH edges AS (
      SELECT $1::timestamptz starts_at,
        CASE WHEN $4::boolean THEN date_trunc('day',$2::timestamptz AT TIME ZONE 'Asia/Tbilisi') AT TIME ZONE 'Asia/Tbilisi'
          ELSE $2::timestamptz END ends_at
    ), windows AS (
      SELECT 'current' AS period, starts_at, ends_at FROM edges
      UNION ALL SELECT 'previous', starts_at - $3::int * interval '1 day', ends_at - $3::int * interval '1 day' FROM edges
    ), counted AS (
      SELECT w.period,e.kind,count(*)::bigint n
        FROM windows w JOIN analytics_events e ON e.created_at >= w.starts_at AND e.created_at < w.ends_at
        WHERE e.kind IN ('search','view','outbound','apply','call','cv','email') GROUP BY 1,2
      UNION ALL
      SELECT w.period,d.kind,sum(d.count)::bigint
        FROM windows w JOIN analytics_daily d ON d.day >= (w.starts_at AT TIME ZONE 'Asia/Tbilisi')::date
          AND (d.day::timestamp AT TIME ZONE 'Asia/Tbilisi') < w.ends_at
        WHERE d.kind IN ('search','view','outbound','apply','call','cv','email') GROUP BY 1,2
    ), history AS (
      SELECT min(first_day) AS first_day FROM (
        SELECT (min(created_at) AT TIME ZONE 'Asia/Tbilisi')::date AS first_day FROM analytics_events WHERE kind='search'
        UNION ALL SELECT min(day) FROM analytics_daily WHERE kind='search'
      ) firsts
    )
    SELECT w.period, w.ends_at > w.starts_at AS duration,
      to_char(w.starts_at AT TIME ZONE 'Asia/Tbilisi','YYYY-MM-DD"T"HH24:MI') AS "from",
      to_char(w.ends_at AT TIME ZONE 'Asia/Tbilisi','YYYY-MM-DD"T"HH24:MI') AS "to",
      COALESCE((w.starts_at AT TIME ZONE 'Asia/Tbilisi')::date > (SELECT first_day FROM history),false) AS covered,
      COALESCE((SELECT sum(n) FROM counted WHERE period=w.period AND kind='search'),0)::int search,
      COALESCE((SELECT sum(n) FROM counted WHERE period=w.period AND kind='view'),0)::int view,
      COALESCE((SELECT sum(n) FROM counted WHERE period=w.period AND kind='outbound'),0)::int outbound,
      COALESCE((SELECT sum(n) FROM counted WHERE period=w.period AND kind = ANY($5::text[])),0)::int contacts,
      (SELECT count(*)::int FROM swipe_applications WHERE status='sent' AND sent_at >= w.starts_at AND sent_at < w.ends_at) sends,
      (SELECT count(*)::int FROM job_submissions WHERE NOT is_test AND created_at >= w.starts_at AND created_at < w.ends_at) AS "receivedPosts"
    FROM windows w ORDER BY w.period`,
      [...params, days, completedDays, contactKinds],
    )
  ).rows;
  const current = rows.find((row) => row.period === 'current')!;
  const previous = rows.find((row) => row.period === 'previous')!;
  const metrics = (row: typeof current): ComparisonMetrics => ({
    search: row.search,
    view: row.view,
    outbound: row.outbound,
    sends: row.sends,
    receivedPosts: row.receivedPosts,
  });
  return {
    from: current.from,
    to: current.to,
    previousFrom: previous.from,
    previousTo: previous.to,
    mode: completedDays
      ? 'completed-days'
      : period === 'yesterday'
        ? 'full-day'
        : 'same-time',
    available: previous.covered && current.duration,
    contactCounts: { current: current.contacts, previous: previous.contacts },
    current: metrics(current),
    previous: metrics(previous),
  };
}
