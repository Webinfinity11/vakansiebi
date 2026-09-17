import { db } from './db';

export type ScraperMetricRow = {
  label: string;
  imported: number;
  changed: number;
  failed: number;
  runs: number;
  minutes: number;
  measured_runs: number;
  discovery_runs: number;
  new_attempts: number | null;
  recheck_attempts: number | null;
  unchanged: number | null;
  linked: number | null;
};
export type ScraperMetrics = {
  daily: ScraperMetricRow[];
  sources: ScraperMetricRow[];
};

const aggregates = `count(*)::int runs, COALESCE(sum(imported),0)::int imported,
  COALESCE(sum(changed),0)::int changed, COALESCE(sum(failed),0)::int failed,
  round(COALESCE(sum(extract(epoch FROM (finished_at-started_at))),0)/60,1)::float8 minutes,
  count(*) FILTER(WHERE metrics IS NOT NULL)::int measured_runs,
  count(*) FILTER(WHERE run_kind<>'repair')::int discovery_runs,
  sum((metrics->>'new_attempts')::int)::int new_attempts,
  sum((metrics->>'recheck_attempts')::int)::int recheck_attempts,
  sum((metrics->>'unchanged')::int)::int unchanged,
  sum((metrics->>'linked')::int)::int linked`;

export async function scraperMetrics(
  connection: Pick<ReturnType<typeof db>, 'query'> = db(),
): Promise<ScraperMetrics> {
  // Aggregate in PostgreSQL; never transfer vacancy text for dashboard statistics.
  const daily = await connection.query(`WITH days AS (
    SELECT to_char(d,'YYYY-MM-DD') label FROM generate_series(
      (now() AT TIME ZONE 'Asia/Tbilisi')::date-6,
      (now() AT TIME ZONE 'Asia/Tbilisi')::date,interval '1 day') d
  ), totals AS (
    SELECT to_char(finished_at AT TIME ZONE 'Asia/Tbilisi','YYYY-MM-DD') label,${aggregates}
    FROM source_runs WHERE finished_at>=((now() AT TIME ZONE 'Asia/Tbilisi')::date-6) AT TIME ZONE 'Asia/Tbilisi'
    GROUP BY 1
  ) SELECT days.label,COALESCE(t.imported,0)::int imported,COALESCE(t.changed,0)::int changed,
    COALESCE(t.failed,0)::int failed,COALESCE(t.runs,0)::int runs,COALESCE(t.minutes,0)::float8 minutes,
    COALESCE(t.measured_runs,0)::int measured_runs,COALESCE(t.discovery_runs,0)::int discovery_runs,
    t.new_attempts,t.recheck_attempts,t.unchanged,t.linked
    FROM days LEFT JOIN totals t USING(label) ORDER BY days.label DESC`);
  const sources = await connection.query(`SELECT source_id label,${aggregates}
    FROM source_runs WHERE finished_at>now()-interval '24 hours' GROUP BY source_id ORDER BY imported DESC,source_id`);
  return { daily: daily.rows, sources: sources.rows };
}
