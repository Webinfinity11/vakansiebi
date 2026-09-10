import 'dotenv/config';
import { db, transaction } from '../lib/server/db';
import { searchPlan } from '../lib/server/search-plan';
import { sourceLockIds } from '../worker/adapters';
const apply = process.argv.includes('--apply');
try {
  console.log(
    await transaction(async (c) => {
      if (apply)
        for (const source of ['hr', 'jobs', 'ss', 'hrgov'] as const)
          if (
            !(
              await c.query('SELECT pg_try_advisory_xact_lock($1) locked', [
                sourceLockIds[source],
              ])
            ).rows[0].locked
          )
            throw Error('Source worker active; retry when it finishes');
      const plan = searchPlan(new URLSearchParams());
      const rows = (
        await c.query(
          `${plan.cte} SELECT i.id,i.source_id FROM searchable j JOIN source_items i ON i.job_id=j.id WHERE ${plan.where} AND i.url=j.published->>'url'`,
          plan.args,
        )
      ).rows;
      if (apply) {
        await c.query(
          'UPDATE source_items SET refresh_requested_at=now(),next_check_at=now() WHERE id=ANY($1::uuid[])',
          [rows.map((r) => r.id)],
        );
      }
      return {
        apply,
        total: rows.length,
        bySource: Object.fromEntries(
          ['hr', 'jobs', 'ss', 'hrgov'].map((s) => [
            s,
            rows.filter((r) => r.source_id === s).length,
          ]),
        ),
      };
    }),
  );
} finally {
  await db().end();
}
