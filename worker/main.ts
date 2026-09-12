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
import { purgeEnded } from './purge';
import { failureNeedsPerson, timeoutsBeforeAlarm } from './http';
import { rollupAnalytics } from '../lib/server/analytics';
let stopped = false;
let lastPurge = 0;
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
          // A timeout that has not yet repeated is the network, not the source.
          const failed = 'error' in result && Boolean(result.error);
          const needsPerson =
            failed &&
            failureNeedsPerson(
              result.error || '',
              Boolean(result.deferred),
              result.consecutiveFailures,
            );
          const retriedTimeout = failed && !result.deferred && !needsPerson;
          if (process.env.GITHUB_STEP_SUMMARY) {
            const status =
              'deferred' in result && result.deferred
                ? 'deferred: network unavailable; automatic retry scheduled'
                : retriedTimeout
                  ? 'network timeout: retried automatically'
                  : 'error' in result
                    ? 'failed'
                    : 'structural' in result && result.structural
                      ? 'needs attention'
                      : 'warning' in result && result.warning
                        ? 'partial: retried automatically'
                        : 'skipped' in result
                          ? 'skipped'
                          : 'success';
            appendFileSync(
              process.env.GITHUB_STEP_SUMMARY,
              `Source: ${source}: ${status}\n\nImported: ${'imported' in result ? result.imported : 0}; changed: ${'changed' in result ? result.changed : 0}; failed: ${'failed' in result ? result.failed : 0}. Automatic publication follows each source's database setting.\n\n`,
            );
          }
          const structural =
            (needsPerson && 'error' in result ? result.error : null) ||
            ('structural' in result ? result.structural : null);
          const degraded = structural
            ? null
            : retriedTimeout && 'error' in result
              ? `${result.error} (${result.consecutiveFailures} of ${timeoutsBeforeAlarm} in a row before this needs a person)`
              : 'warning' in result
                ? result.warning
                : null;
          // A red job must mean the source needs a person. Transient page failures and quality
          // holds retry on their own, so they stay visible as warnings instead.
          if (process.env.GITHUB_ACTIONS && (structural || degraded))
            console.warn(
              `::${structural ? 'error' : 'warning'} title=Source ${source}::${structural || degraded}`,
            );
          if ((once || arg) && structural) process.exitCode = 1;
        },
      });
    }
    // Ended vacancies past their window are deleted at most hourly: the continuous worker loops
    // every few seconds, and parallel scraper jobs skip on the lock.
    const purgeDue = Date.now() - lastPurge >= 3600000;
    if (purgeDue) lastPurge = Date.now();
    const purged = !purgeDue
      ? null
      : await purgeEnded({ apply: true }).catch((error) => {
          console.warn(
            'Purge skipped:',
            error instanceof Error ? error.message : error,
          );
          return null;
        });
    // Separate from the purge: an analytics failure must not hold back deleting ended vacancies.
    if (purgeDue)
      await rollupAnalytics(db()).catch((error) =>
        console.warn(
          'Analytics rollup skipped:',
          error instanceof Error ? error.message : error,
        ),
      );
    if (purged?.applied && purged.expired + purged.removed > 0)
      console.log(
        `Purged ended vacancies: ${purged.expired} expired, ${purged.removed} removed`,
      );
    if (once || arg) break;
    await delay(5000);
  } while (!stopped);
} finally {
  await db().end();
}
