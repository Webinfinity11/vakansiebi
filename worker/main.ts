import 'dotenv/config';
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
if (arg && !(arg in configs)) throw Error('Unknown source');
try {
  do {
    const sources = arg
      ? [{ id: arg }]
      : (
          await db().query(
            'SELECT id FROM sources WHERE id=ANY($1::text[]) AND enabled AND NOT retired AND (requested_at IS NOT NULL OR (auto_enabled AND next_run_at<=now())) ORDER BY requested_at NULLS LAST,next_run_at',
            [Object.keys(configs)],
          )
        ).rows;
    for (const source of sources) {
      if (stopped) break;
      console.log(JSON.stringify(await runSource(source.id as SourceId)));
    }
    if (once || arg) break;
    await delay(5000);
  } while (!stopped);
} finally {
  await db().end();
}
