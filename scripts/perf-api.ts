import 'dotenv/config';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import type { QueryResult } from 'pg';
import { db } from '../lib/server/db';
import { clearPublicJobsCache, publicJobs } from '../lib/server/jobs';
import { publicJobsCacheKey } from '../lib/server/jobs-cache';
import { publicRead, searchPlan } from '../lib/server/search-plan';
import { employerPages, employerPagesIfReady } from '../lib/server/employers';
import { companyKey } from '../lib/company-key';
import { resolveCompanyLogos } from '../lib/server/company-logos';

// Local production-copy benchmark. Never run against the live database.
// DATABASE_URL=postgresql://ertad@127.0.0.1:55432/ertad_perf npx tsx scripts/perf-api.ts --out=/tmp/perf-before.json
// Repeat with --compare=/tmp/perf-before.json --out=/tmp/perf-after.json after migrating.
const flags = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, ...value] = arg.replace(/^--/, '').split('=');
    return [key, value.join('=')];
  }),
);
const url = new URL(process.env.DATABASE_URL!);
assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname));
assert.equal(url.pathname, '/ertad_perf');
const warmups = Number(flags.get('warmups') ?? 3);
const runs = Number(flags.get('runs') ?? 15);
assert.ok(Number.isInteger(warmups) && warmups >= 0);
assert.ok(Number.isInteger(runs) && runs > 0);
const output = flags.get('out') || '/tmp/perf-api.json';
const previous = flags.has('compare')
  ? JSON.parse(await readFile(flags.get('compare')!, 'utf8'))
  : null;
const pool = db();
const query = pool.query.bind(pool);
type Observation = {
  sql: string;
  args: unknown[];
  ms: number;
  result: QueryResult;
};
let observations: Observation[] | null = null;
// Observe the actual statement through both pool.query's callback and the
// transaction client's promise overload; retain the client's public signature.
pool.on('connect', (client) => {
  const execute = client.query.bind(client);
  client.query = ((
    sql: string,
    args: unknown[] = [],
    callback?: (error: Error | null, result?: QueryResult) => void,
  ) => {
    const collector = observations;
    const start = performance.now();
    const record = (result: QueryResult) => {
      collector?.push({ sql, args, ms: performance.now() - start, result });
      return result;
    };
    if (callback)
      return execute(sql, args, (error, result) => {
        if (!error) record(result);
        callback(error, result);
      });
    return execute(sql, args).then(record);
  }) as typeof client.query;
});
const percentile = (samples: number[]) => {
  const sorted = [...samples].sort((a, b) => a - b);
  const at = (p: number) =>
    Math.round(sorted[Math.ceil(p * sorted.length) - 1] * 100) / 100;
  return { p50: at(0.5), p95: at(0.95) };
};
const measure = async (fn: () => Promise<unknown>) => {
  for (let n = 0; n < warmups; n++) await fn();
  const samples: number[] = [];
  for (let n = 0; n < runs; n++) {
    const start = performance.now();
    await fn();
    samples.push(performance.now() - start);
  }
  return percentile(samples);
};
const cutMarker = '\n    SELECT (SELECT count(*)::int FROM matches';
// Isolated CTE reads can omit the filters that normally supply parameter types.
const boundParameters = (args: unknown[]) =>
  args.length
    ? `, perf_parameters AS (SELECT ${args.map((arg, i) => `$${i + 1}::${typeof arg === 'number' ? 'int' : Array.isArray(arg) ? 'text[]' : 'text'} AS p${i}`).join(',')})`
    : '';
try {
  const [{ rows: settings }, { rows: counts }] = await Promise.all([
    query(
      "SELECT name,setting,unit FROM pg_settings WHERE name IN ('server_version','shared_buffers','work_mem','jit','max_parallel_workers_per_gather')",
    ),
    query('SELECT status,count(*)::int FROM jobs GROUP BY status'),
  ]);
  const category =
    previous?.category ??
    (
      await query(
        "SELECT published->>'category' AS name,count(*) FROM jobs WHERE status='published' GROUP BY 1 ORDER BY count(*) DESC,name LIMIT 1",
      )
    ).rows[0].name;
  const exclude =
    previous?.exclude ??
    (
      await query(
        "SELECT id FROM jobs WHERE status='published' ORDER BY published_at DESC,id LIMIT 5",
      )
    ).rows
      .map((row) => row.id)
      .join(',');
  const cases = [
    ['empty', {}],
    ['page2', { page: '2' }],
    ['cashier', { q: 'მოლარე' }],
    ['sales', { q: 'გაყიდვების მენეჯერი' }],
    ['tbilisi', { city: 'თბილისი' }],
    ['category', { category }],
    ['remote', { remote: 'true' }],
    ['paid', { paid: 'true' }],
    ['salary', { sort: 'salary' }],
    ['countsOnly', { countsOnly: '1' }],
    ['exclude', { exclude }],
  ] as const;
  // The summary route starts this directory in the background. Warm it explicitly
  // to keep cold directory construction out of steady-state SQL measurements.
  const directoryStart = performance.now();
  await employerPages();
  const directoryColdMs = performance.now() - directoryStart;
  const report = {
    at: new Date().toISOString(),
    warmups,
    runs,
    settings,
    counts,
    category,
    exclude,
    directoryColdMs,
    cases: [] as Record<string, unknown>[],
  };
  for (const [name, values] of cases) {
    if (flags.has('cases') && !flags.get('cases')!.split(',').includes(name))
      continue;
    const params = new URLSearchParams({ summary: '1', page: '1', ...values });
    const totalSamples: number[] = [],
      statementSamples: number[] = [],
      enrichmentSamples: number[] = [];
    let statement: Observation | undefined;
    let result: Awaited<ReturnType<typeof publicJobs>> | undefined;
    for (let n = -warmups; n < runs; n++) {
      clearPublicJobsCache();
      observations = [];
      const start = performance.now();
      result = await publicJobs(params);
      const elapsed = performance.now() - start;
      statement = observations.find((item) =>
        item.sql.startsWith('WITH searchable AS'),
      );
      assert.ok(statement, 'publicJobs must execute its database statement');
      if (n >= 0) {
        totalSamples.push(elapsed);
        statementSamples.push(statement.ms);
        enrichmentSamples.push(Math.max(0, elapsed - statement.ms));
      }
      observations = null;
    }
    assert.ok(statement && result);
    const identity = {
      total: result.total,
      ids: result.jobs.map((job) => job.id),
    };
    const before = previous?.cases.find(
      (item: { name: string }) => item.name === name,
    );
    if (previous) {
      assert.ok(before, `Missing baseline ${name}`);
      assert.deepEqual(
        identity,
        before.identity,
        `Changed IDs/order/total: ${name}`,
      );
      // Category ordering is not an API contract; compare facet values by name.
      assert.deepEqual(
        [...result.search.categories].sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
        before.categories,
        `Changed category counts: ${name}`,
      );
    }
    const plan = searchPlan(params, false, { grouped: true });
    const phase: Record<string, unknown> = {
      publicJobs: percentile(totalSamples),
      statement: percentile(statementSamples),
      afterStatement: percentile(enrichmentSamples),
    };
    if (publicJobsCacheKey(params) !== null) {
      observations = [];
      phase.cacheHit = await measure(() => publicJobs(params));
      assert.ok(
        !observations.some((item) => item.sql.startsWith('WITH searchable AS')),
        'A warm public response must not rebuild the SQL statement',
      );
      observations = null;
    }
    if (!params.has('countsOnly') && !flags.has('quick')) {
      const rows = statement.result.rows[0].page_rows as {
        published: { company?: string; logoUrl?: string };
      }[];
      const keys = [
        ...new Set(rows.map((row) => companyKey(row.published.company || ''))),
      ];
      const names = rows
        .filter((row) => !row.published.logoUrl)
        .map((row) => row.published.company || '');
      phase.enrichmentOnly = await measure(() =>
        Promise.all([
          publicRead(
            'SELECT company_key,logo_url FROM company_profiles WHERE company_key=ANY($1::text[])',
            [keys],
          ),
          resolveCompanyLogos(names),
          employerPagesIfReady(),
        ]),
      );
    }
    const client = await pool.connect();
    try {
      if (!flags.has('quick')) {
        phase.searchable = await measure(() =>
          client.query(
            `${plan.cte}${boundParameters(plan.args)} SELECT count(*) FROM searchable`,
            plan.args,
          ),
        );
        phase.metricsWithCte = await measure(() =>
          client.query(plan.metrics, plan.args),
        );
        const cut = statement.sql.indexOf(cutMarker);
        assert.ok(cut > 0, 'Expected publicJobs metrics/page boundary');
        const pageSql = params.has('countsOnly')
          ? null
          : statement.sql.slice(0, cut) +
            " SELECT COALESCE(jsonb_agg(to_jsonb(pg) ORDER BY pg.ord),'[]'::jsonb) FROM page pg";
        if (pageSql)
          phase.pageWithCte = await measure(() =>
            client.query(pageSql, statement!.args),
          );
        // Materialize once to measure the metrics/page consumers without rebuilding
        // searchable. Keep the same CTE boundary and members/source aggregation.
        await client.query(
          `CREATE TEMP TABLE perf_searchable AS ${plan.cte}${boundParameters(plan.args)} SELECT * FROM searchable`,
          plan.args,
        );
        await client.query('ANALYZE perf_searchable');
        const membersAt = plan.cte.indexOf('), members AS MATERIALIZED');
        assert.ok(membersAt > 0);
        const withoutExtraction = (sql: string) =>
          sql.replace(
            plan.cte.slice(0, membersAt + 1),
            'WITH searchable AS MATERIALIZED (SELECT * FROM perf_searchable)',
          );
        // Keep unused parameter types inferable when the extraction owns a bind (exclude).
        // pg accepts unused positional binds only when their types are specified.
        const parameterTypes = (sql: string, args: unknown[]) => {
          const casts = args
            .map(
              (arg, i) =>
                `$${i + 1}::${typeof arg === 'number' ? 'int' : Array.isArray(arg) ? 'text[]' : 'text'} IS NULL`,
            )
            .join(' OR ');
          return sql.replace(
            'SELECT * FROM perf_searchable)',
            `SELECT * FROM perf_searchable WHERE NOT (${casts}) OR true)`,
          );
        };
        phase.metricsOnly = await measure(() =>
          client.query(
            parameterTypes(withoutExtraction(plan.metrics), plan.args),
            plan.args,
          ),
        );
        if (pageSql)
          phase.pageOnly = await measure(() =>
            client.query(
              parameterTypes(withoutExtraction(pageSql), statement!.args),
              statement!.args,
            ),
          );
        await client.query('DROP TABLE perf_searchable');
      }
      if (['empty', 'cashier'].includes(name)) {
        const explain = await client.query(
          'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ' + statement.sql,
          statement.args,
        );
        await writeFile(
          output.replace(/\.json$/, '') + `-${name}-explain.json`,
          JSON.stringify(explain.rows[0]['QUERY PLAN'], null, 2),
        );
      }
    } finally {
      client.release();
    }
    const item = {
      name,
      params: params.toString(),
      payloadBytes: Buffer.byteLength(JSON.stringify(result)),
      identity,
      categories: [...result.search.categories].sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
      phase,
    };
    report.cases.push(item);
    await writeFile(output, JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ name, total: identity.total, ...phase }));
  }
  console.log(
    `Saved ${output}${previous ? '; all IDs/order/totals/facets match baseline' : ''}`,
  );
} finally {
  observations = null;
  await pool.end();
}
