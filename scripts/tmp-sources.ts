import 'dotenv/config';
import { db } from '../lib/server/db';
const now = await db().query(`
  SELECT s.name, s.enabled, s.retired, s.consecutive_failures AS fails,
         to_char(s.last_success_at AT TIME ZONE 'Asia/Tbilisi','MM-DD HH24:MI') AS last_ok,
         to_char(s.last_started_at AT TIME ZONE 'Asia/Tbilisi','MM-DD HH24:MI') AS last_try,
         left(COALESCE(s.last_error,''), 70) AS error
  FROM sources s WHERE NOT s.retired ORDER BY s.consecutive_failures DESC, s.name`);
console.table(now.rows);
const runs = await db().query(`
  SELECT s.name, r.status, count(*)::int n, sum(r.imported)::int imported, left(max(COALESCE(r.error,'')), 60) AS error
  FROM source_runs r JOIN sources s ON s.id = r.source_id
  WHERE r.started_at > now() - interval '24 hours'
  GROUP BY 1,2 ORDER BY 1,2`);
console.log('runs in the last 24 hours:');
console.table(runs.rows);
process.exit(0);
