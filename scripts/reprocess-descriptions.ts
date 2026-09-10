import 'dotenv/config';
import { db } from '../lib/server/db';
import { refreshDescriptions } from '../worker/refresh';
import type { ActiveSourceId } from '../lib/types';
const source = process.argv
  .find((a) => a.startsWith('--source='))
  ?.split('=')[1] as ActiveSourceId;
const limit =
  Number(process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1]) ||
  500;
try {
  const result = await refreshDescriptions(source, limit);
  console.log(JSON.stringify(result));
  if (result.failed) process.exitCode = 1;
} finally {
  await db().end();
}
