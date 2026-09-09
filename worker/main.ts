import 'dotenv/config';
import { appendFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { db } from '../lib/server/db';
import { runSource } from './run';
import { configs } from './adapters';
import type { SourceId } from '../lib/types';
let stopped = false;
process.on('SIGTERM', () => {
  stopped = true;
});
process.on('SIGINT', () => {
  stopped = true;
});
const arg = process.argv.find((a) => a.startsWith('--source='))?.split('=')[1];
const once = process.argv.includes('--once');
const dueOnly = process.argv.includes('--due');
if (arg && !(arg in configs)) throw Error('Unknown source');
try {
  do {
    const sources =
      arg && !dueOnly
        ? [{ id: arg }]
        : (
            await db().query(
              'SELECT id FROM sources WHERE id=ANY($1::text[]) AND ($2::text IS NULL OR id=$2) AND enabled AND NOT retired AND (requested_at IS NOT NULL OR (auto_enabled AND next_run_at<=now())) ORDER BY requested_at NULLS LAST,next_run_at',
              [Object.keys(configs), arg || null],
            )
          ).rows;
    if (!sources.length)
      console.log(
        JSON.stringify({
          source: arg || 'all',
          skipped: true,
          reason: 'No enabled sources are due',
        }),
      );
    for (const source of sources) {
      if (stopped) break;
      const result = await runSource(source.id as SourceId);
      console.log(JSON.stringify(result));
      if (process.env.GITHUB_STEP_SUMMARY) {
        const status =
          'error' in result
            ? 'failed'
            : 'warning' in result && result.warning
              ? 'partial'
              : 'skipped' in result
                ? 'skipped'
                : 'success';
        appendFileSync(
          process.env.GITHUB_STEP_SUMMARY,
          `Source: ${source.id}: ${status}\n\nImported: ${'imported' in result ? result.imported : 0}; changed: ${'changed' in result ? result.changed : 0}; failed: ${'failed' in result ? result.failed : 0}. New vacancies require admin approval.\n\n`,
        );
      }
      if (
        (once || arg) &&
        (('error' in result && result.error) ||
          ('warning' in result && result.warning))
      )
        process.exitCode = 1;
    }
    if (once || arg) break;
    await delay(5000);
  } while (!stopped);
} finally {
  await db().end();
}
