import 'dotenv/config';
import { mkdirSync, writeFileSync } from 'node:fs';
import { db, transaction } from '../lib/server/db';
import { enrichVacancy } from '../worker/enrich';
import { hashVacancy, audit } from '../worker/importer';
import { vacancySchema } from '../lib/vacancy-schema';
// Published salaries whose text names a price the amount reader used to miss
// ("1, 200 ლარი", "ხელფასი ფიქსირებული 900 ლარი"). Only the numeric amount,
// currency and period are filled in, from the stored source copy; no source is
// fetched, and a job an editor has taken over is left alone.
const apply = process.argv.includes('--apply');
try {
  const rows = (
    await db()
      .query(`SELECT i.id item_id,i.raw,j.id job_id,j.version,j.published
    FROM jobs j JOIN source_items i ON i.job_id=j.id AND i.url=j.published->>'url'
    JOIN sources s ON s.id=i.source_id
    WHERE j.status='published' AND j.automation_managed AND NOT j.automation_paused
    AND s.enabled AND NOT s.retired AND i.error IS NULL AND i.quality_warning IS NULL
    AND COALESCE(i.raw->>'salary','') ~ '[0-9]' AND i.raw->>'salaryMin' IS NULL
    AND j.published->>'salary'=i.raw->>'salary' AND j.published->>'salaryMin' IS NULL
    ORDER BY j.id`)
  ).rows;
  if (apply) {
    mkdirSync('.local/backups', { recursive: true });
    writeFileSync(
      '.local/backups/salary-amounts-' + Date.now() + '.json',
      JSON.stringify(rows),
    );
  }
  let found = 0;
  let updated = 0;
  for (const row of rows) {
    const next = enrichVacancy(row.raw);
    if (next.salaryMin === null) continue;
    found++;
    const pay = {
      salaryMin: next.salaryMin,
      currency: next.currency,
      salaryPeriod: next.salaryPeriod,
    };
    if (found <= 20)
      console.log(JSON.stringify({ salary: row.raw.salary, ...pay }));
    if (!apply) continue;
    const changed = await transaction(async (c) => {
      const item = (
        await c.query('SELECT * FROM source_items WHERE id=$1 FOR UPDATE', [
          row.item_id,
        ])
      ).rows[0];
      const job = (
        await c.query('SELECT * FROM jobs WHERE id=$1 FOR UPDATE', [row.job_id])
      ).rows[0];
      if (
        !item ||
        !job ||
        job.version !== row.version ||
        job.status !== 'published' ||
        !job.automation_managed ||
        job.automation_paused ||
        item.raw.salary !== row.raw.salary ||
        item.raw.salaryMin !== null ||
        job.published.salary !== row.raw.salary ||
        job.published.salaryMin !== null
      )
        return false;
      const raw = { ...item.raw, ...pay };
      vacancySchema.parse(raw);
      await c.query(
        'UPDATE source_items SET raw=$2,content_hash=$3 WHERE id=$1',
        [item.id, raw, hashVacancy(raw)],
      );
      await c.query(
        `UPDATE jobs SET published=published || $2::jsonb,
         draft=CASE WHEN draft->>'salary'=published->>'salary' AND draft->>'salaryMin' IS NULL THEN draft || $2::jsonb ELSE draft END,
         version=version+1 WHERE id=$1`,
        [job.id, pay],
      );
      await audit(
        c,
        job.id,
        'source.salary_amount_read',
        'parser:salary-summary',
        { salaryMin: null },
        pay,
      );
      return true;
    });
    if (changed) updated++;
  }
  console.log(
    JSON.stringify({ candidates: rows.length, readable: found, updated }),
  );
} finally {
  await db().end();
}
