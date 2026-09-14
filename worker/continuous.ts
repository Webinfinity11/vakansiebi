import 'dotenv/config';
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { Pool } from 'pg';
import { configs } from './adapters';
import { SourceScheduler, dueSourcesSql } from './scheduler';

let stopped = false;
let lastPoll = 0;
if (!process.env.DATABASE_URL)
  throw new Error('DATABASE_URL is not configured');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  connectionTimeoutMillis: 10_000,
  query_timeout: 15_000,
  statement_timeout: 15_000,
});
const wake = new AbortController();
const children = new Set<ChildProcess>();
const reportError = (source: string, error: unknown) =>
  console.error(
    JSON.stringify({
      event: 'worker_error',
      source,
      error: error instanceof Error ? error.message : String(error),
    }),
  );
const scheduler = new SourceScheduler(
  (source) =>
    new Promise<void>((resolve, reject) => {
      console.log(JSON.stringify({ event: 'source_start', source }));
      const child = spawn(
        process.execPath,
        [
          '--import',
          'tsx',
          'worker/main.ts',
          `--source=${source}`,
          '--due',
          '--once',
        ],
        {
          stdio: 'inherit',
          env: process.env,
        },
      );
      children.add(child);
      // Bound a stuck network/database child even if its own budget cannot advance.
      const watchdog = setTimeout(() => child.kill('SIGKILL'), 32 * 60_000);
      child.once('error', reject);
      child.once('close', (code, signal) => {
        clearTimeout(watchdog);
        children.delete(child);
        console.log(
          JSON.stringify({ event: 'source_exit', source, code, signal }),
        );
        if (code === 0 || stopped) resolve();
        else reject(new Error(`Source process exited: ${code ?? signal}`));
      });
    }),
  reportError,
);

// Railway checks the scheduler and database connection before accepting a deploy.
// No public domain is required for this endpoint.
const health = createServer((req, res) => {
  const healthy = !stopped && lastPoll > 0 && Date.now() - lastPoll < 120_000;
  res.writeHead(req.url === '/health' ? (healthy ? 200 : 503) : 404, {
    'content-type': 'application/json',
  });
  res.end(
    JSON.stringify({ ok: healthy, active: [...scheduler.active.keys()] }),
  );
});
health.listen(Number(process.env.PORT || 8080), '0.0.0.0');

function shutdown() {
  if (stopped) return;
  stopped = true;
  wake.abort();
  for (const child of children) child.kill('SIGTERM');
  // main.ts finishes an in-flight request on SIGTERM; bound deployment shutdown.
  setTimeout(() => {
    for (const child of children) child.kill('SIGKILL');
  }, 20_000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
try {
  while (!stopped) {
    try {
      const due = await pool.query(dueSourcesSql, [Object.keys(configs)]);
      lastPoll = Date.now();
      scheduler.tick(due.rows.map((row: { id: string }) => row.id));
    } catch (error) {
      reportError('scheduler', error);
    }
    await delay(30_000, undefined, { signal: wake.signal }).catch(() => {});
  }
} finally {
  await scheduler.stop();
  health.close();
  await pool.end();
}
