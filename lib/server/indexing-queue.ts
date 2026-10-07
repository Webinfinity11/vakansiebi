import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { db } from './db';
import {
  indexingDailyLimit,
  publish,
  type IndexingNotification,
  type IndexingDelivery,
} from './google-indexing';
import { vacancyIdFrom } from '../vacancy-navigation';
import { jobPosting, vacancyUrl } from '../seo';
import type { Vacancy } from '../types';

type Connection = Pick<Pool | PoolClient, 'query'>;
type Queued = {
  url: string;
  job_id: string;
  type: IndexingNotification['type'];
  content_hash: string;
  attempts: number;
  lease_token: string;
};

// Enqueue in the publication transaction, including publishers without credentials.
export async function enqueueIndexingNotifications(
  events: readonly IndexingNotification[],
  connection: Connection,
) {
  for (const event of events) {
    const jobId = vacancyIdFrom(
      decodeURIComponent(
        new URL(event.url).pathname.slice('/vacancies/'.length),
      ),
    );
    if (!jobId) continue;
    await connection.query(
      `INSERT INTO google_indexing_queue(url,job_id,type,content_hash)
       VALUES($1,$2,$3,$4)
       ON CONFLICT(url) DO UPDATE SET type=excluded.type,content_hash=excluded.content_hash,
         status='pending',attempts=0,available_at=now(),lease_token=NULL,locked_until=NULL,
         last_http_status=NULL,last_error=NULL,sent_at=NULL,updated_at=now()
       WHERE google_indexing_queue.type IS DISTINCT FROM excluded.type
          OR google_indexing_queue.content_hash IS DISTINCT FROM excluded.content_hash`,
      [event.url, jobId, event.type, event.contentHash || event.url],
    );
  }
}

export function indexingRetrySeconds(attempts: number) {
  return Math.min(21600, 60 * 2 ** Math.min(9, Math.max(0, attempts - 1)));
}

export async function drainIndexingQueue({
  connection,
  urls,
  limit = 50,
  send = publish,
  settings = process.env,
}: {
  connection?: Connection;
  urls?: string[];
  limit?: number;
  send?: (
    url: string,
    type: IndexingNotification['type'],
  ) => Promise<IndexingDelivery>;
  settings?: Record<string, string | undefined>;
} = {}) {
  const result = {
    sent: 0,
    retried: 0,
    cancelled: 0,
    rejected: 0,
    deferred: 0,
    disabled: false,
  };
  if (
    !settings.GOOGLE_INDEXING_CLIENT_EMAIL?.trim() ||
    !settings.GOOGLE_INDEXING_PRIVATE_KEY?.trim() ||
    !indexingDailyLimit(settings.GOOGLE_INDEXING_DAILY_LIMIT)
  ) {
    result.disabled = true;
    return result;
  }
  const c = connection || db();
  for (let n = 0; n < Math.max(0, Math.min(200, limit)); n++) {
    const token = randomUUID();
    const row = (
      await c.query(
        `WITH next AS (
         SELECT url FROM google_indexing_queue
         WHERE status='pending' AND available_at<=now()
           AND (locked_until IS NULL OR locked_until<now())
           AND ($2::text[] IS NULL OR url=ANY($2))
         ORDER BY created_at DESC,url FOR UPDATE SKIP LOCKED LIMIT 1
       ) UPDATE google_indexing_queue q SET lease_token=$1,locked_until=now()+interval '2 minutes'
         FROM next WHERE q.url=next.url RETURNING q.*`,
        [token, urls || null],
      )
    ).rows[0] as Queued | undefined;
    if (!row) break;
    const job = (
      await c.query(
        'SELECT j.status,j.published,EXISTS(SELECT 1 FROM job_submissions s WHERE s.job_id=j.id AND s.is_test) AS is_test FROM jobs j WHERE j.id=$1',
        [row.job_id],
      )
    ).rows[0] as
      | { status: string; published: Vacancy | null; is_test?: boolean }
      | undefined;
    const current =
      job?.status === 'published' && !job.is_test && job.published
        ? jobPosting({
            ...job.published,
            id: row.job_id,
            createdAt: '',
            sources: [],
          })
        : null;
    if (
      row.type === 'URL_UPDATED' &&
      (!current ||
        vacancyUrl({ id: row.job_id, title: job!.published!.title }) !==
          row.url)
    ) {
      await c.query(
        `UPDATE google_indexing_queue SET status='cancelled',lease_token=NULL,locked_until=NULL,last_error='page-unavailable',updated_at=now() WHERE url=$1 AND lease_token=$2`,
        [row.url, token],
      );
      result.cancelled++;
      continue;
    }
    let delivery: IndexingDelivery;
    try {
      delivery = await send(row.url, row.type);
    } catch {
      delivery = { status: 'failed', reason: 'request-failed' };
    }
    if (delivery.status === 'sent') {
      await c.query(
        `UPDATE google_indexing_queue SET status='sent',attempts=attempts+1,sent_at=now(),last_http_status=$3,last_error=NULL,lease_token=NULL,locked_until=NULL,updated_at=now() WHERE url=$1 AND lease_token=$2`,
        [row.url, token, delivery.httpStatus || 200],
      );
      result.sent++;
    } else if (
      delivery.reason === 'daily-budget' ||
      delivery.reason === 'disabled' ||
      delivery.reason === 'credentials-unavailable'
    ) {
      const tomorrow = delivery.reason === 'daily-budget';
      await c.query(
        `UPDATE google_indexing_queue SET available_at=CASE WHEN $3 THEN ((now() AT TIME ZONE 'America/Los_Angeles')::date+1)::timestamp AT TIME ZONE 'America/Los_Angeles' ELSE now()+interval '5 minutes' END,last_error=$4,lease_token=NULL,locked_until=NULL,updated_at=now() WHERE url=$1 AND lease_token=$2`,
        [row.url, token, tomorrow, delivery.reason],
      );
      result.deferred++;
      break;
    } else {
      const rejected =
        delivery.status === 'skipped' ||
        delivery.httpStatus === 400 ||
        delivery.httpStatus === 404;
      await c.query(
        `UPDATE google_indexing_queue SET status=CASE WHEN $3 THEN 'rejected' ELSE 'pending' END,attempts=attempts+1,available_at=now()+$4*interval '1 second',last_http_status=$5,last_error=$6,lease_token=NULL,locked_until=NULL,updated_at=now() WHERE url=$1 AND lease_token=$2`,
        [
          row.url,
          token,
          rejected,
          indexingRetrySeconds(row.attempts + 1),
          delivery.httpStatus || null,
          delivery.reason || 'request-failed',
        ],
      );
      if (rejected) result.rejected++;
      else result.retried++;
      // Authorization/quota failures affect the service, not this vacancy.
      // Stop this batch instead of spending the remaining quota on the same error.
      if ([401, 403, 429].includes(delivery.httpStatus || 0)) break;
    }
  }
  return result;
}

export async function indexingQueueStatus(connection: Connection = db()) {
  const [queue, budget] = await Promise.all([
    connection.query(
      `SELECT status,count(*)::int AS count,max(sent_at) AS last_sent_at FROM google_indexing_queue GROUP BY status`,
    ),
    connection.query(
      `SELECT requests FROM google_indexing_daily WHERE day=(now() AT TIME ZONE 'America/Los_Angeles')::date`,
    ),
  ]);
  return { queue: queue.rows, requestsToday: budget.rows[0]?.requests || 0 };
}
