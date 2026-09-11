import { transaction } from './db';
import { dispatchScraper } from './scraper-github';

// The queue is durable even if GitHub is temporarily unavailable. Serialize
// dispatches across Vercel instances and double clicks without an in-memory lock.
export async function wakeScraper() {
  return transaction(async (c) => {
    const { rows } = await c.query(
      "SELECT pg_try_advisory_xact_lock(hashtext('admin-scraper-dispatch')) AS locked",
    );
    if (!rows[0].locked)
      return { dispatched: false, reason: 'already_requested' } as const;
    const recent = await c.query(
      "SELECT 1 FROM audit_log WHERE action='scraper.dispatch' AND created_at>now()-interval '60 seconds' LIMIT 1",
    );
    if (recent.rowCount)
      return { dispatched: false, reason: 'already_requested' } as const;
    const result = await dispatchScraper();
    if (result.dispatched)
      await c.query(
        "INSERT INTO audit_log(action,actor) VALUES('scraper.dispatch','admin')",
      );
    return result;
  });
}
