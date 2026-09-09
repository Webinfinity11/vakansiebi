import { randomUUID } from 'node:crypto';
import { load } from 'cheerio';
import { db } from '../lib/server/db';
import type { SourceId } from '../lib/types';
import {
  getSourceConfig,
  externalId,
  listLinks,
  parseDetail,
  additionalListing,
  sourceLockIds,
  UnavailableVacancy,
} from './adapters';
import { sourceFetch, validateUrl, SourceHttpError } from './http';
import { discoverItems, stageVacancy } from './importer';
export async function runSource(
  source: SourceId,
  limit = Number(process.env.CRAWL_BATCH_SIZE) || 20,
) {
  const activeConfig = getSourceConfig(source);
  const lock = await db().connect();
  const lockId = sourceLockIds[source];
  limit = Math.max(1, Math.min(100, Math.floor(limit) || 20));
  let locked = false;
  const runId = randomUUID();
  let started = false;
  let imported = 0,
    changed = 0,
    failed = 0,
    discovered = 0,
    removed = 0,
    linked = 0,
    expired = 0;
  try {
    locked = (
      await lock.query('SELECT pg_try_advisory_lock($1) AS locked', [lockId])
    ).rows[0].locked;
    if (!locked) return { skipped: true };
    const config = (
      await db().query('SELECT * FROM sources WHERE id=$1', [source])
    ).rows[0];
    if (!config?.enabled || config.retired) return { skipped: true };
    await db().query(
      "UPDATE source_runs SET status='interrupted',finished_at=now(),error='Worker interrupted; next run retries pending items' WHERE source_id=$1 AND status='running'",
      [source],
    );
    await db().query('INSERT INTO source_runs(id,source_id) VALUES($1,$2)', [
      runId,
      source,
    ]);
    started = true;
    await db().query(
      'UPDATE sources SET last_started_at=now(),requested_at=NULL WHERE id=$1',
      [source],
    );
    const html = await sourceFetch(source, activeConfig.list);
    const links = listLinks(source, html);
    if (!links.length)
      throw Error(
        'Listing returned no vacancy links; source structure may have changed',
      );
    const sitemap = activeConfig.sitemap;
    let discoveryWarning = '';
    const extraPages = [
      ...new Set(
        Array.from({ length: 3 }, (_, offset) =>
          additionalListing(source, html, config.sitemap_cursor + offset),
        ).filter((url): url is string => !!url),
      ),
    ];
    for (const extra of extraPages) {
      try {
        links.push(
          ...listLinks(source, await sourceFetch(source, extra), extra),
        );
        await db().query(
          'UPDATE sources SET sitemap_cursor=sitemap_cursor+1 WHERE id=$1',
          [source],
        );
      } catch (e) {
        discoveryWarning = 'Listing page: ' + (e as Error).message;
        break;
      }
    }
    if (sitemap) {
      try {
        const xml = await sourceFetch(source, sitemap);
        const $ = load(xml, { xml: true });
        const pages = $('sitemap > loc')
          .map((_, e) => $(e).text())
          .get();
        const documents = pages.length
          ? [
              await sourceFetch(
                source,
                validateUrl(source, pages[config.sitemap_cursor % pages.length])
                  .href,
              ),
            ]
          : [xml];
        for (const doc of documents) {
          const x = load(doc, { xml: true });
          x('url > loc').each((_, e) => {
            const url = x(e).text().trim();
            try {
              const id = externalId(source, url);
              if (id) links.push({ externalId: id, url });
            } catch {}
          });
        }
        if (pages.length)
          await db().query(
            'UPDATE sources SET sitemap_cursor=sitemap_cursor+1 WHERE id=$1',
            [source],
          );
      } catch (e) {
        discoveryWarning = 'Sitemap: ' + (e as Error).message;
      }
    }
    const unique = [...new Map(links.map((a) => [a.externalId, a])).values()];
    await discoverItems(source, unique);
    discovered = unique.length;
    // Split the budget between backlog and rechecks so neither can starve the other.
    const quota = Math.max(1, Math.floor(limit * 0.75));
    const pending = (
      await db().query(
        'SELECT * FROM source_items WHERE source_id=$1 AND raw IS NULL AND next_check_at<=now() ORDER BY discovered_at,id LIMIT $2',
        [source, limit],
      )
    ).rows;
    const existing = (
      await db().query(
        'SELECT * FROM source_items WHERE source_id=$1 AND raw IS NOT NULL AND next_check_at<=now() ORDER BY next_check_at LIMIT $2',
        [source, Math.max(1, limit - Math.min(pending.length, quota))],
      )
    ).rows;
    const newCount = Math.min(pending.length, limit - existing.length);
    let consecutiveDetailFailures = 0;
    let stoppedEarly = false;
    for (const item of [...pending.slice(0, newCount), ...existing].slice(
      0,
      limit,
    )) {
      try {
        const data = parseDetail(
          source,
          await sourceFetch(source, item.url),
          item.url,
        );
        const outcome = await stageVacancy(
          item.id,
          data,
          config.detail_interval_hours,
        );
        consecutiveDetailFailures = 0;
        if (outcome === 'imported') imported++;
        if (outcome === 'changed') changed++;
        if (outcome === 'linked') linked++;
        if (outcome === 'expired') expired++;
      } catch (e) {
        if (
          (e instanceof SourceHttpError && [404, 410].includes(e.status)) ||
          e instanceof UnavailableVacancy
        ) {
          removed++;
          consecutiveDetailFailures = 0;
          await db().query(
            "UPDATE source_items SET last_checked_at=now(),error=$2,next_check_at=now()+interval '7 days' WHERE id=$1",
            [item.id, e.message],
          );
          if (item.job_id)
            await db().query(
              "UPDATE jobs SET needs_review=true,version=version+1 WHERE id=$1 AND NOT needs_review AND status IN ('pending','published')",
              [item.job_id],
            );
          continue;
        }
        failed++;
        consecutiveDetailFailures++;
        await db().query(
          "UPDATE source_items SET last_checked_at=now(),failures=failures+1,error=$2,next_check_at=now()+(LEAST(1440,30*power(2,LEAST(failures,5)))*interval '1 minute') WHERE id=$1",
          [item.id, (e as Error).message.slice(0, 500)],
        );
        // Stop a broken source without exhausting its backlog.
        if (consecutiveDetailFailures >= 3) {
          stoppedEarly = true;
          break;
        }
      }
    }
    const warning =
      [
        discoveryWarning,
        stoppedEarly
          ? 'Stopped after 3 consecutive detail failures; remaining items retained for retry'
          : null,
        failed ? `${failed} detail pages failed` : null,
      ]
        .filter(Boolean)
        .join('; ') || null;
    await db().query(
      'UPDATE source_runs SET status=$2,finished_at=now(),discovered=$3,imported=$4,changed=$5,failed=$6,error=$7 WHERE id=$1',
      [
        runId,
        warning ? 'partial' : 'success',
        discovered,
        imported,
        changed,
        failed,
        warning,
      ],
    );
    await db().query(
      "UPDATE sources SET last_success_at=CASE WHEN $2::text IS NULL THEN now() ELSE last_success_at END,last_error=$2,consecutive_failures=0,next_run_at=now()+(interval_minutes*interval '1 minute') WHERE id=$1",
      [source, warning],
    );
    return {
      source,
      discovered,
      imported,
      changed,
      failed,
      removed,
      linked,
      expired,
      warning,
    };
  } catch (e) {
    const error = (e as Error).message.slice(0, 500);
    if (started) {
      await db().query(
        "UPDATE source_runs SET status='failed',finished_at=now(),error=$2,discovered=$3,imported=$4,changed=$5,failed=$6 WHERE id=$1",
        [runId, error, discovered, imported, changed, failed],
      );
      await db().query(
        "UPDATE sources SET last_error=$2,consecutive_failures=consecutive_failures+1,next_run_at=now()+(LEAST(1440,interval_minutes*power(2,LEAST(consecutive_failures,5)))*interval '1 minute') WHERE id=$1",
        [source, error],
      );
    }
    return { source, error };
  } finally {
    if (locked) await lock.query('SELECT pg_advisory_unlock($1)', [lockId]);
    lock.release();
  }
}
