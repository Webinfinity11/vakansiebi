import { db } from './db';
import { buildFunnel, postLadder, postLabels } from '../analytics-funnel';
import type { FunnelStep } from '../analytics-funnel';
import type { Ranked } from './analytics';

export const postingWindows = [7, 30, 90] as const;
export type PostingWindow = (typeof postingWindows)[number];

const statuses = [
  'pending',
  'published',
  'rejected',
  'archived',
  'merged',
] as const;
type Status = (typeof statuses)[number];
const tiers = ['standard', 'vip', 'premium'] as const;

export type PostingAnalytics = {
  days: PostingWindow;
  /** First and last Tbilisi day of the window, inclusive. */
  from: string;
  to: string;
  /** The posting form, from its own events: counts of steps, not of people. */
  form: {
    steps: FunnelStep[];
    /** Where a started form was left, by stage. */
    left: { name: string; label: string; count: number }[];
    /** Which field stopped a press of "send", most frequent first. */
    invalid: { name: string; count: number }[];
    /** Everything else the form reports: draft_restored, logo_added, logo_failed, refused, failed. */
    other: Ranked[];
  };
  /** What really arrived in job_submissions, test submissions excluded. */
  received: {
    total: number;
    byStatus: Record<Status, number>;
    /** Requested placement, each with where its submissions stand now. */
    byPlacement: ({ tier: (typeof tiers)[number]; total: number } & Record<
      Status,
      number
    >)[];
    /** How the arrived vacancies were filled in. */
    filled: {
      logo: number;
      salary: number;
      deadline: number;
      email: number;
      phone: number;
      link: number;
    };
    categories: Ranked[];
    cities: Ranked[];
    /** Median hours from arrival to publication, for those published; null when none. */
    reviewHours: number | null;
  };
  /** One row per Tbilisi day: form opens and sends from events, arrivals from the table. */
  daily: { day: string; opened: number; done: number; received: number }[];
};

/* Everything is read by whole Tbilisi days, so a 7-day window is today and the six before
   it, and the daily table — which cannot split a day — adds up to the same numbers as the
   raw one. Raw events cover 30 days and the rollup what is older; both are read, and the
   rollup moves rows between them atomically, so nothing is counted twice. */
export async function postingAnalytics(
  days: PostingWindow,
): Promise<PostingAnalytics> {
  const first = `((now() AT TIME ZONE 'Asia/Tbilisi')::date - ($1::int - 1))`;
  const since = `(${first}::timestamp AT TIME ZONE 'Asia/Tbilisi')`;
  const [events, daily, received, placements, spread] = await Promise.all([
    db().query<{ value: string; count: number }>(
      `SELECT value, sum(n)::int count FROM (
         SELECT value, count(*)::int n FROM analytics_events
           WHERE kind='post' AND created_at >= ${since} GROUP BY value
         UNION ALL
         SELECT value, sum(count)::int FROM analytics_daily
           WHERE kind='post' AND day >= ${first} GROUP BY value) e
       GROUP BY value ORDER BY count DESC, value`,
      [days],
    ),
    db().query<{
      day: string;
      opened: number;
      done: number;
      received: number;
    }>(
      `WITH days AS (SELECT generate_series(${first}, (now() AT TIME ZONE 'Asia/Tbilisi')::date, interval '1 day')::date AS day),
       events AS (
         SELECT (created_at AT TIME ZONE 'Asia/Tbilisi')::date AS day, value, count(*)::int n
           FROM analytics_events
           WHERE kind='post' AND value IN ('opened','done') AND created_at >= ${since} GROUP BY 1,2
         UNION ALL
         SELECT day, value, sum(count)::int FROM analytics_daily
           WHERE kind='post' AND value IN ('opened','done') AND day >= ${first} GROUP BY 1,2),
       arrived AS (
         SELECT (created_at AT TIME ZONE 'Asia/Tbilisi')::date AS day, count(*)::int n
           FROM job_submissions WHERE NOT is_test AND created_at >= ${since} GROUP BY 1)
       SELECT to_char(d.day,'YYYY-MM-DD') AS day,
         COALESCE((SELECT sum(n) FROM events e WHERE e.day=d.day AND e.value='opened'),0)::int AS opened,
         COALESCE((SELECT sum(n) FROM events e WHERE e.day=d.day AND e.value='done'),0)::int AS done,
         COALESCE((SELECT n FROM arrived a WHERE a.day=d.day),0)::int AS received
       FROM days d ORDER BY d.day`,
      [days],
    ),
    /* The draft is the vacancy as it arrived; an admin's edits go to what is published. */
    db().query<{
      total: number;
      logo: number;
      salary: number;
      deadline: number;
      email: number;
      phone: number;
      link: number;
      review_hours: number | null;
    }>(
      `SELECT count(*)::int total,
         count(*) FILTER (WHERE coalesce(j.draft->>'logoUrl','')<>'')::int logo,
         count(*) FILTER (WHERE coalesce(j.draft->>'salary','')<>'')::int salary,
         count(*) FILTER (WHERE coalesce(j.draft->>'deadline','')<>'')::int deadline,
         count(*) FILTER (WHERE j.draft->'facts' @> '[{"label":"ელფოსტა CV-სთვის"}]')::int email,
         count(*) FILTER (WHERE j.draft->'facts' @> '[{"label":"ტელეფონი"}]')::int phone,
         count(*) FILTER (WHERE jsonb_array_length(coalesce(j.draft->'applicationLinks','[]'))>0)::int link,
         round((percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM j.published_at - s.created_at))
           FILTER (WHERE j.published_at >= s.created_at) / 3600)::numeric, 1)::float review_hours
       FROM job_submissions s JOIN jobs j ON j.id=s.job_id
       WHERE NOT s.is_test AND s.created_at >= ${since}`,
      [days],
    ),
    db().query<{ tier: string; status: string; n: number }>(
      `SELECT s.requested_placement tier, j.status, count(*)::int n
       FROM job_submissions s JOIN jobs j ON j.id=s.job_id
       WHERE NOT s.is_test AND s.created_at >= ${since} GROUP BY 1,2`,
      [days],
    ),
    db().query<{ field: 'category' | 'city'; value: string; count: number }>(
      `WITH arrived AS (SELECT j.draft FROM job_submissions s JOIN jobs j ON j.id=s.job_id
         WHERE NOT s.is_test AND s.created_at >= ${since}),
       counted AS (
         SELECT 'category' field, coalesce(nullif(draft->>'category',''),'—') value, count(*)::int count FROM arrived GROUP BY 2
         UNION ALL
         SELECT 'city', coalesce(nullif(draft->>'city',''),'დისტანციური'), count(*)::int FROM arrived GROUP BY 2),
       ranked AS (SELECT *, row_number() OVER (PARTITION BY field ORDER BY count DESC, value) position FROM counted)
       SELECT field, value, count FROM ranked WHERE position <= 8 ORDER BY field, position`,
      [days],
    ),
  ]);
  const funnel = buildFunnel(events.rows, postLadder, postLabels);
  const known = new Set(postLadder.map(([name]) => name as string));
  const empty = () =>
    Object.fromEntries(statuses.map((s) => [s, 0])) as Record<Status, number>;
  const byStatus = empty();
  const byPlacement = tiers.map((tier) => ({ tier, total: 0, ...empty() }));
  for (const row of placements.rows) {
    const status = row.status as Status;
    if (!(status in byStatus)) continue;
    byStatus[status] += row.n;
    const tier = byPlacement.find((p) => p.tier === row.tier);
    if (!tier) continue;
    tier[status] += row.n;
    tier.total += row.n;
  }
  const summary = received.rows[0];
  const spreadOf = (field: 'category' | 'city') =>
    spread.rows
      .filter((row) => row.field === field)
      .map(({ value, count }) => ({ value, count }));
  return {
    days,
    from: daily.rows[0]?.day ?? '',
    to: daily.rows.at(-1)?.day ?? '',
    form: {
      steps: funnel.steps,
      left: funnel.left,
      invalid: funnel.refused,
      other: events.rows.filter(
        ({ value }) =>
          !known.has(value) &&
          !value.startsWith('left_') &&
          !value.startsWith('invalid_'),
      ),
    },
    received: {
      total: summary.total,
      byStatus,
      byPlacement,
      filled: {
        logo: summary.logo,
        salary: summary.salary,
        deadline: summary.deadline,
        email: summary.email,
        phone: summary.phone,
        link: summary.link,
      },
      categories: spreadOf('category'),
      cities: spreadOf('city'),
      reviewHours: summary.review_hours,
    },
    daily: daily.rows,
  };
}
