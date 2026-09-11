import 'dotenv/config';
import { appendFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { db } from '../lib/server/db';
import { runSource } from './run';
import { refreshDescriptions } from './refresh';
import type { ActiveSourceId } from '../lib/types';
import { configs } from './adapters';
import { runSourceCycle } from './cycle';
import { reconcileSource } from './automation';
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
    for (const source of (arg
      ? [arg]
      : Object.keys(configs)) as ActiveSourceId[]) {
      if (stopped) break;
      await runSourceCycle(source, {
        refresh: refreshDescriptions,
        discover: runSource,
        reconcile: reconcileSource,
        stopped: () => stopped,
        isDue: async (id) => {
          if (arg && !dueOnly) return true;
          return (
            (
              await db().query(
                'SELECT id FROM sources WHERE id=$1 AND enabled AND NOT retired AND (requested_at IS NOT NULL OR (auto_enabled AND next_run_at<=now()))',
                [id],
              )
            ).rowCount === 1
          );
        },
        reportRefresh: (refresh) => {
          if (
            !refresh.refreshed &&
            !refresh.failed &&
            !refresh.held &&
            !refresh.removed
          )
            return;
          console.log(JSON.stringify({ descriptionRefresh: refresh }));
          if (refresh.failed || refresh.held) {
            console.warn(
              `Description refresh ${source}: ${refresh.failed} failed, ${refresh.held} held; retained for retry. Discovery continues when due.`,
            );
            if (process.env.GITHUB_ACTIONS)
              console.warn(
                `::warning title=Description refresh (${source})::${refresh.failed} failed, ${refresh.held} held; retained for retry. Discovery continues when due.`,
              );
          }
          if (process.env.GITHUB_STEP_SUMMARY)
            appendFileSync(
              process.env.GITHUB_STEP_SUMMARY,
              `Full description refresh — ${source}: updated ${refresh.refreshed}, held ${refresh.held}, failed ${refresh.failed}, removed ${refresh.removed}, remaining ${refresh.remaining}.\n\n`,
            );
        },
        reportAutomation: (result) => {
          if (Object.keys(result).length)
            console.log(JSON.stringify({ automation: source, ...result }));
        },
        reportDiscovery: (result) => {
          console.log(JSON.stringify(result));
          if (process.env.GITHUB_STEP_SUMMARY) {
            const status =
              'deferred' in result && result.deferred
                ? 'deferred: network unavailable; automatic retry scheduled'
                : 'error' in result
                  ? 'failed'
                  : 'warning' in result && result.warning
                    ? 'partial'
                    : 'skipped' in result
                      ? 'skipped'
                      : 'success';
            appendFileSync(
              process.env.GITHUB_STEP_SUMMARY,
              `Source: ${source}: ${status}\n\nImported: ${'imported' in result ? result.imported : 0}; changed: ${'changed' in result ? result.changed : 0}; failed: ${'failed' in result ? result.failed : 0}. Automatic publication follows each source's database setting.\n\n`,
            );
          }
          if (
            (once || arg) &&
            (('error' in result && result.error && !result.deferred) ||
              ('warning' in result && result.warning))
          )
            process.exitCode = 1;
        },
      });
    }
    if (once || arg) break;
    await delay(5000);
  } while (!stopped);
} finally {
  await db().end();
}
