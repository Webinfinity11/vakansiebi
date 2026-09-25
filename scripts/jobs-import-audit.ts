import 'dotenv/config';
import { db } from '../lib/server/db';

/* Read-only: what the jobs.ge imports of the last week actually were.

   The worker reports about 45 imports per run and runs out of time on nearly every run, while
   jobs.ge shows about 130 new postings a day. This splits each day's imports by what became of
   them, how old the posting already was when it arrived, and whether an earlier record had the
   same title, employer and city — a repost, or a posting read twice. */
const source = process.argv.find((a) => a.startsWith('--source='))?.split('=')[1] ?? 'jobs';

try {
  const { rows } = await db().query(
    `WITH imported AS (
       SELECT j.id, j.status, j.created_at, j.fingerprint,
              (j.created_at AT TIME ZONE 'Asia/Tbilisi')::date AS day,
              nullif(j.draft->>'datePosted','') AS posted,
              nullif(j.draft->>'deadline','') AS deadline
         FROM source_items i JOIN jobs j ON j.id = i.job_id
        WHERE i.source_id = $1 AND j.created_at > now() - interval '7 days')
     SELECT day,
            count(*)::int AS imported,
            count(*) FILTER (WHERE status = 'published')::int AS published,
            count(*) FILTER (WHERE status = 'pending')::int AS pending,
            count(*) FILTER (WHERE status IN ('archived','rejected','merged'))::int AS ended,
            count(*) FILTER (WHERE posted IS NULL)::int AS no_date,
            count(*) FILTER (WHERE posted >= to_char(created_at AT TIME ZONE 'Asia/Tbilisi' - interval '1 day','YYYY-MM-DD'))::int AS fresh,
            count(*) FILTER (WHERE posted < to_char(created_at AT TIME ZONE 'Asia/Tbilisi' - interval '7 days','YYYY-MM-DD'))::int AS older_week,
            count(*) FILTER (WHERE deadline < to_char(created_at AT TIME ZONE 'Asia/Tbilisi','YYYY-MM-DD'))::int AS expired_on_arrival,
            count(*) FILTER (WHERE EXISTS (SELECT 1 FROM jobs e WHERE e.fingerprint = imported.fingerprint
                                            AND e.created_at < imported.created_at AND e.id <> imported.id))::int AS repeat_of_earlier
       FROM imported GROUP BY day ORDER BY day`,
    [source],
  );
  console.table(rows);
  console.log(
    'fresh = posted that day or the day before; older_week = posted more than a week before it arrived;',
    '\nrepeat_of_earlier = an earlier record has the same title, employer and city.',
  );
} finally {
  await db().end();
}
