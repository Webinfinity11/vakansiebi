import { db } from './db';

/* Anonymous usage counts. What is stored is only ever a kind, a value and a time — never an IP
   address, a cookie, a session or a user agent — so a row cannot be traced back to a person.
   The rate limiter in the route keys on the address in memory to stop abuse, and discards it. */
export const eventKinds = [
  'search',
  'search_empty',
  'view',
  'outbound',
] as const;
export type EventKind = (typeof eventKinds)[number];

const uuid = /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i;

/* Returns the value as it will be stored, or null when the event should not be recorded.
   A search is folded to lower case with its spacing collapsed, so "Მოლარე " and "მოლარე" count
   as one; a view or an outbound click must name a real vacancy id. Anything else is refused
   rather than trimmed into something the reader never typed. */
export function normalizeEvent(
  kind: unknown,
  value: unknown,
): {
  kind: EventKind;
  value: string;
} | null {
  if (typeof kind !== 'string' || !eventKinds.includes(kind as EventKind))
    return null;
  if (typeof value !== 'string') return null;
  if (kind === 'view' || kind === 'outbound')
    return uuid.test(value) ? { kind, value: value.toLowerCase() } : null;
  const query = value
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
  if (query.length < 2 || query.length > 80) return null;
  return { kind: kind as EventKind, value: query };
}

export async function recordEvent(kind: EventKind, value: string) {
  await db().query('INSERT INTO analytics_events(kind,value) VALUES($1,$2)', [
    kind,
    value,
  ]);
}

export type Ranked = {
  value: string;
  count: number;
  title?: string;
  company?: string;
};
export type AnalyticsSummary = {
  days: number;
  totals: Record<EventKind, number>;
  searches: Ranked[];
  emptySearches: Ranked[];
  views: Ranked[];
  outbound: Ranked[];
};

/* Raw events cover the last 30 days and daily totals cover what is older, so a window reads
   both and adds them. The two never overlap: the rollup moves an event from one table to the
   other inside a single statement, so no upper bound on the daily side is needed and a boundary
   day cannot fall between them. A vacancy row is matched for its title where it still exists; a deleted
   vacancy keeps its count and simply has no title. */
export async function analyticsSummary(
  days = 30,
  top = 20,
): Promise<AnalyticsSummary> {
  const since = `now() - ($1::int * interval '1 day')`;
  const counted = `(SELECT kind, value, count(*)::int n FROM analytics_events WHERE created_at >= ${since} GROUP BY 1,2
     UNION ALL
     SELECT kind, value, sum(count)::int n FROM analytics_daily WHERE day >= ((${since}) AT TIME ZONE 'Asia/Tbilisi')::date GROUP BY 1,2)`;
  const totals = (
    await db().query(
      `SELECT kind, sum(n)::int n FROM ${counted} c GROUP BY 1`,
      [days],
    )
  ).rows;
  const ranked = async (kind: EventKind, withJob: boolean) =>
    (
      await db().query(
        `SELECT c.value, sum(c.n)::int count${withJob ? ",max(j.published->>'title') title,max(j.published->>'company') company" : ''}
         FROM ${counted} c ${withJob ? 'LEFT JOIN jobs j ON j.id::text=c.value' : ''}
         WHERE c.kind=$2 GROUP BY c.value ORDER BY count DESC, c.value LIMIT $3`,
        [days, kind, top],
      )
    ).rows.map((r) => ({
      value: r.value,
      count: r.count,
      ...(withJob && r.title
        ? { title: r.title, company: r.company || '' }
        : {}),
    }));
  const byKind = Object.fromEntries(eventKinds.map((k) => [k, 0])) as Record<
    EventKind,
    number
  >;
  for (const row of totals) byKind[row.kind as EventKind] = row.n;
  return {
    days,
    totals: byKind,
    searches: await ranked('search', false),
    emptySearches: await ranked('search_empty', false),
    views: await ranked('view', true),
    outbound: await ranked('outbound', true),
  };
}

/* Folds raw events older than 30 days into daily totals and deletes them, in one transaction
   so an event is never both counted in a total and still present, nor lost from both. */
export async function rollupAnalytics(client: {
  query: (sql: string) => Promise<{ rowCount: number | null }>;
}) {
  const folded = await client.query(
    `WITH old AS (DELETE FROM analytics_events WHERE created_at < now() - interval '30 days' RETURNING kind, value, created_at)
     INSERT INTO analytics_daily(day, kind, value, count)
     SELECT (created_at AT TIME ZONE 'Asia/Tbilisi')::date, kind, value, count(*) FROM old GROUP BY 1,2,3
     ON CONFLICT (day, kind, value) DO UPDATE SET count = analytics_daily.count + excluded.count`,
  );
  return folded.rowCount ?? 0;
}
