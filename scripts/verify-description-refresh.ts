import 'dotenv/config';
import { db } from '../lib/server/db';
const source =
  process.argv.find((a) => a.startsWith('--source='))?.split('=')[1] || null;
try {
  const result = (
    await db().query(
      `SELECT count(*) FILTER(WHERE i.refresh_completed_at>=i.refresh_requested_at)::int completed,
 count(*) FILTER(WHERE i.refresh_completed_at IS NULL OR i.refresh_completed_at<i.refresh_requested_at)::int pending,
 count(*) FILTER(WHERE i.error IS NOT NULL AND (i.refresh_completed_at IS NULL OR i.refresh_completed_at<i.refresh_requested_at))::int retrying,
 count(*) FILTER(WHERE i.refresh_completed_at>=i.refresh_requested_at AND j.status='published' AND j.automation_managed AND NOT j.automation_paused
   AND i.error IS NULL AND i.quality_warning IS NULL AND j.published->>'url'=i.url
   AND btrim(j.published->>'description',chr(32)||chr(10)||chr(13)||chr(9)||chr(65279)||chr(160)) IS DISTINCT FROM btrim(i.raw->>'description',chr(32)||chr(10)||chr(13)||chr(9)||chr(65279)||chr(160)))::int text_mismatches
 FROM source_items i LEFT JOIN jobs j ON j.id=i.job_id WHERE i.refresh_requested_at IS NOT NULL AND ($1::text IS NULL OR i.source_id=$1)`,
      [source],
    )
  ).rows[0];
  console.log(JSON.stringify({ source: source || 'all', ...result }));
  if (result.text_mismatches) process.exitCode = 1;
} finally {
  await db().end();
}
