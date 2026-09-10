import 'dotenv/config';
import { db } from '../lib/server/db';
import { searchPlan } from '../lib/server/search-plan';
import { enrichExistingBatch } from '../worker/enrich-existing';
const apply = process.argv.includes('--apply');
const includeEditorial = process.argv.includes('--include-editorial');
try {
  const plan = searchPlan(new URLSearchParams());
  const rows = (
    await db().query(
      `${plan.cte} SELECT j.id FROM searchable j WHERE ${plan.where} ORDER BY j.id`,
      plan.args,
    )
  ).rows;
  const total = { jobs: 0, sources: 0, salaryFilled: 0, amountsRecovered: 0 };
  for (let i = 0; i < rows.length; i += 100) {
    const result = await enrichExistingBatch(
      rows.slice(i, i + 100).map((row) => row.id),
      apply,
      includeEditorial,
    );
    for (const key of Object.keys(total) as (keyof typeof total)[])
      total[key] += result[key];
    console.log(
      JSON.stringify({
        apply,
        scanned: Math.min(i + 100, rows.length),
        ...result,
      }),
    );
  }
  console.log(JSON.stringify({ apply, scanned: rows.length, total }));
} finally {
  await db().end();
}
