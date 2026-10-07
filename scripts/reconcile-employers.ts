import dotenv from 'dotenv';
import { db } from '../lib/server/db';
import { reconcileEmployers } from '../worker/employers';
dotenv.config({ path: ['.env.local', '.env'], quiet: true });
try {
  console.log(JSON.stringify(await reconcileEmployers(true)));
} finally {
  await db().end();
}
