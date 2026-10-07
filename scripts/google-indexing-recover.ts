import 'dotenv/config';
import { db, transaction } from '../lib/server/db';
import { indexingTransition } from '../lib/server/google-indexing';
import { enqueueIndexingNotifications } from '../lib/server/indexing-queue';
import type { Vacancy } from '../lib/types';

// Explicit, bounded recovery of recent publications; never announce the full archive.
const count = Number(
  process.argv.find((arg) => arg.startsWith('--recent='))?.slice(9) || 50,
);
const ids = process.argv
  .filter((arg) => arg.startsWith('--id='))
  .map((arg) => arg.slice(5));
if (
  !Number.isInteger(count) ||
  count < 0 ||
  count > 200 ||
  ids.length > 20 ||
  ids.some((id) => !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id))
)
  throw Error('Use --recent=0..200 and at most 20 valid --id=UUID values.');

try {
  const candidates = (
    await db().query(
      `SELECT j.id,j.status,j.published FROM jobs j
     WHERE j.status='published' AND NOT EXISTS(SELECT 1 FROM job_submissions s WHERE s.job_id=j.id AND s.is_test)
       AND (j.id=ANY($2::uuid[]) OR j.id IN (
         SELECT id FROM jobs WHERE status='published'
           AND published->>'datePosted'>=to_char(now()-interval '7 days','YYYY-MM-DD')
         ORDER BY published_at DESC NULLS LAST,id LIMIT $1))
     ORDER BY j.published_at DESC NULLS LAST,j.id LIMIT 200`,
      [count, ids],
    )
  ).rows as { id: string; status: string; published: Vacancy | null }[];
  const events = candidates.flatMap((job) =>
    indexingTransition(job.id, { status: 'pending', published: null }, job),
  );
  const apply = process.argv.includes('--apply');
  if (apply)
    await transaction((connection) =>
      enqueueIndexingNotifications(events, connection),
    );
  console.log(
    JSON.stringify({
      apply,
      candidates: candidates.length,
      supported: events.length,
      urls: events.map((event) => event.url),
    }),
  );
} finally {
  await db().end();
}
