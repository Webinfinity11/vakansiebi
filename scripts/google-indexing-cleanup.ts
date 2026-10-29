import 'dotenv/config';
import { db } from '../lib/server/db';
import { pruneIndexingQueue } from '../lib/server/indexing-queue';

try {
  console.log(
    JSON.stringify(
      await pruneIndexingQueue({
        apply: process.argv.includes('--apply'),
        limit: 10000,
      }),
    ),
  );
} finally {
  await db().end();
}
