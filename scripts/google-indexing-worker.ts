import 'dotenv/config';
import { db } from '../lib/server/db';
import {
  drainIndexingQueue,
  indexingQueueStatus,
} from '../lib/server/indexing-queue';
try {
  const delivered = await drainIndexingQueue();
  const status = await indexingQueueStatus();
  console.log(JSON.stringify({ indexing: delivered, ...status }));
  if (delivered.retried || delivered.rejected || delivered.disabled)
    console.warn(
      'Indexing notifications require attention; delivery status is recorded in the database.',
    );
} finally {
  await db().end();
}
