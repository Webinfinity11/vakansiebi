import { createHmac } from 'node:crypto';
import type { PoolClient } from 'pg';
import { ApiError } from './auth';

/* One address gets eight tries in fifteen minutes, as before. The total ceiling only stops a
   guessing run spread over many addresses; it is high enough that a single noisy client can
   no longer lock the admin out, which the old shared counter of eight allowed. */
export const perClientLimit = 8;
export const totalLimit = 100;

/* Stored keyed, so the table never holds visitor addresses. */
export function clientTag(address: string) {
  return createHmac('sha256', process.env.SESSION_SECRET || '')
    .update(address)
    .digest('hex')
    .slice(0, 32);
}

export async function recordLoginAttempt(c: PoolClient, client: string) {
  await c.query('SELECT pg_advisory_xact_lock(917402)');
  await c.query(
    "DELETE FROM login_attempts WHERE created_at<now()-interval '15 minutes'",
  );
  const { mine, total } = (
    await c.query(
      'SELECT count(*) FILTER (WHERE client=$1)::int mine, count(*)::int total FROM login_attempts',
      [client],
    )
  ).rows[0];
  if (mine >= perClientLimit || total >= totalLimit)
    throw new ApiError('მრავალი მცდელობა. სცადე 15 წუთში.', 429);
  await c.query('INSERT INTO login_attempts(client) VALUES($1)', [client]);
}
