import 'dotenv/config';
import { db } from '../lib/server/db';
const r = await db().query(`
  SELECT name, enabled, auto_enabled, interval_minutes AS every_min,
         to_char(next_run_at AT TIME ZONE 'Asia/Tbilisi','MM-DD HH24:MI') AS next_run,
         (next_run_at < now()) AS due,
         to_char(lease_until AT TIME ZONE 'Asia/Tbilisi','MM-DD HH24:MI') AS lease_until,
         lease_owner, processing_mode, batch_limit, budget_minutes,
         to_char(discovery_observed_at AT TIME ZONE 'Asia/Tbilisi','MM-DD HH24:MI') AS discovery_seen,
         left(COALESCE(last_error,''),80) AS last_error
  FROM sources WHERE name IN ('vacancy.hr.gov.ge','worknet.moh.gov.ge','jobs.ss.ge')`);
for (const row of r.rows) { console.log('\n' + row.name); for (const [k, v] of Object.entries(row)) if (k !== 'name') console.log('  ', k.padEnd(16), v); }
process.exit(0);
