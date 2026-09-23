import 'dotenv/config';
import { db } from '../lib/server/db';
const fails = await db().query(`
  SELECT s.name, left(si.error, 60) AS error, count(*)::int n,
         to_char(max(si.last_checked_at) AT TIME ZONE 'Asia/Tbilisi','MM-DD HH24:MI') AS latest,
         max(si.failures) AS worst
  FROM source_items si JOIN sources s ON s.id = si.source_id
  WHERE COALESCE(si.error,'') <> '' AND si.last_checked_at > now() - interval '3 days'
  GROUP BY 1,2 ORDER BY n DESC LIMIT 12`);
console.table(fails.rows);
const sample = await db().query(`
  SELECT si.url, left(si.error, 80) AS error, si.failures
  FROM source_items si JOIN sources s ON s.id = si.source_id
  WHERE s.name='gancxadebebi.ge' AND COALESCE(si.error,'') <> ''
  ORDER BY si.last_checked_at DESC LIMIT 5`);
console.log('most recent gancxadebebi.ge failures:');
for (const r of sample.rows) console.log(`  ${r.failures}× ${r.url}\n     ${r.error}`);
process.exit(0);
