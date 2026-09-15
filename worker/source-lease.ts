import { db } from '../lib/server/db';
import type { SourceId } from '../lib/types';

export async function acquireSourceLease(
  source: SourceId,
  owner: string,
  ttlMs: number,
) {
  const result = await db().query(
    `UPDATE sources SET lease_until=now()+($3||' milliseconds')::interval,lease_owner=$2
    WHERE id=$1 AND (lease_until IS NULL OR lease_until<now()) RETURNING id`,
    [source, owner, ttlMs],
  );
  return result.rowCount === 1;
}

export async function renewSourceLease(
  source: SourceId,
  owner: string,
  ttlMs: number,
) {
  const result = await db().query(
    `UPDATE sources SET lease_until=now()+($3||' milliseconds')::interval
    WHERE id=$1 AND lease_owner=$2`,
    [source, owner, ttlMs],
  );
  return result.rowCount === 1;
}

export async function releaseSourceLease(source: SourceId, owner: string) {
  await db().query(
    'UPDATE sources SET lease_until=NULL,lease_owner=NULL WHERE id=$1 AND lease_owner=$2',
    [source, owner],
  );
}

export function startLeaseHeartbeat(
  source: SourceId,
  owner: string,
  ttlMs: number,
) {
  const timer = setInterval(() => {
    void renewSourceLease(source, owner, ttlMs)
      .then((renewed) => {
        if (!renewed)
          throw Error('Source lease is no longer owned by this run');
      })
      .catch((error: unknown) => {
        console.error(
          JSON.stringify({
            source,
            error: 'Source lease renewal failed',
            detail: error instanceof Error ? error.message : String(error),
          }),
        );
      });
  }, ttlMs / 3);
  timer.unref();
  return timer;
}
