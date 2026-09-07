import 'dotenv/config';
import { db } from '../lib/server/db';
import { configs, parseDetail, sourceLockIds } from '../worker/adapters';
import { sourceFetch } from '../worker/http';
import { stageVacancy } from '../worker/importer';
import type { SourceId } from '../lib/types';
// Explicit bounded maintenance: update source snapshots only, never editorial or published fields.
const limit = Math.max(
  1,
  Math.min(
    20,
    Number(process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1]) ||
      3,
  ),
);
const requested = process.argv
  .find((a) => a.startsWith('--source='))
  ?.split('=')[1];
if (requested && !(requested in configs)) throw Error('Unknown source');
try {
  for (const source of (requested
    ? [requested]
    : Object.keys(configs)) as SourceId[]) {
    const client = await db().connect();
    let locked = false;
    try {
      locked = (
        await client.query('SELECT pg_try_advisory_lock($1) AS locked', [
          sourceLockIds[source],
        ])
      ).rows[0].locked;
      if (!locked) {
        console.log(JSON.stringify({ source, skipped: 'worker is active' }));
        continue;
      }
      const items = (
        await client.query(
          'SELECT id,url FROM source_items WHERE source_id=$1 AND raw IS NOT NULL ORDER BY last_checked_at NULLS FIRST,id LIMIT $2',
          [source, limit],
        )
      ).rows;
      for (const item of items) {
        try {
          const data = parseDetail(
            source,
            await sourceFetch(source, item.url),
            item.url,
          );
          const outcome = await stageVacancy(item.id, data);
          console.log(
            JSON.stringify({
              source,
              outcome,
              logo: Boolean(data.logoUrl),
              warnings: data.warnings?.length || 0,
            }),
          );
        } catch (e) {
          console.log(JSON.stringify({ source, error: (e as Error).message }));
          process.exitCode = 1;
        }
      }
    } finally {
      if (locked)
        await client.query('SELECT pg_advisory_unlock($1)', [
          sourceLockIds[source],
        ]);
      client.release();
    }
  }
} finally {
  await db().end();
}
