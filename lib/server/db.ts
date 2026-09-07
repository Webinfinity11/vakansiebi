import { Pool, type PoolClient } from 'pg';
const globalDb = globalThis as unknown as { ertadPool?: Pool };
export function db() {
  if (!process.env.DATABASE_URL)
    throw new Error('DATABASE_URL is not configured');
  return (globalDb.ertadPool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
  }));
}
export async function transaction<T>(fn: (client: PoolClient) => Promise<T>) {
  const c = await db().connect();
  try {
    await c.query('BEGIN');
    const result = await fn(c);
    await c.query('COMMIT');
    return result;
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
  }
}
