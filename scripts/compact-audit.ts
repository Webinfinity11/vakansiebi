// One-off compaction of audit payloads written before auditChange existed.
// Nothing reads before_data/after_data; only action, job_id and created_at are queried.
// The trail keeps what changed, so the history stays readable and stops duplicating records.
import 'dotenv/config';
import { db } from '../lib/server/db';
import { auditChange } from '../worker/importer';
const apply = process.argv.includes('--apply');
const c = await db().connect();
let scanned = 0,
  rewritten = 0,
  before = 0,
  after = 0;
try {
  let cursor = 0;
  for (;;) {
    const rows = (
      await c.query(
        `SELECT id,before_data,after_data,
         0 AS bytes
         FROM audit_log WHERE id>$1 AND (before_data IS NOT NULL OR after_data IS NOT NULL)
         ORDER BY id LIMIT 500`,
        [cursor],
      )
    ).rows;
    if (!rows.length) break;
    for (const row of rows) {
      cursor = row.id;
      scanned++;
      before += Buffer.byteLength(
        JSON.stringify(row.before_data ?? null) +
          JSON.stringify(row.after_data ?? null),
      );
      const [from, to] = auditChange(row.before_data, row.after_data);
      after += Buffer.byteLength(
        JSON.stringify(from ?? null) + JSON.stringify(to ?? null),
      );
      if (
        JSON.stringify(from) === JSON.stringify(row.before_data) &&
        JSON.stringify(to) === JSON.stringify(row.after_data)
      )
        continue;
      rewritten++;
      if (apply)
        await c.query(
          'UPDATE audit_log SET before_data=$2,after_data=$3 WHERE id=$1',
          [row.id, from, to],
        );
    }
  }
  const mb = (n: number) => (n / 1024 / 1024).toFixed(1) + ' MB';
  console.log(
    JSON.stringify({
      scanned,
      rewritten,
      before: mb(before),
      after: mb(after),
      applied: apply,
    }),
  );
} finally {
  c.release();
  await db().end();
}
