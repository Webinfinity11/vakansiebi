import { completeDescription } from './linked-description';
import { assessReportedTotal, structuralFailure } from './quality';
import { randomUUID } from 'node:crypto';
import {
  readDiscoveryInfo,
  discoveryListingUrl,
  planDiscoveryPages,
  DiscoveryPageGuard,
  listingFingerprint,
  type DiscoverySource,
} from './discovery';
import { load } from 'cheerio';
import { db, transaction } from '../lib/server/db';
import { reconcileJob } from './automation';
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
import {
  sourceFetch,
  validateUrl,
  SourceHttpError,
  deferredSourceFailure,
} from './http';
import { discoverItems, stageVacancy } from './importer';
export async function runSource(
  source: SourceId,
  limit = Number(process.env.CRAWL_BATCH_SIZE) || 20,
) {
  const activeConfig = getSourceConfig(source);
  const startedAt = Date.now();
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
    expired = 0,
    qualityHeld = 0,
    budgetExhausted = false;
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
    const paginated = source === 'hr' || source === 'jobs' || source === 'ss';
    const listUrl = paginated
      ? discoveryListingUrl(source as DiscoverySource)
      : activeConfig.list;
    const html = await sourceFetch(source, listUrl);
    const links = listLinks(source, html, listUrl);
    if (!links.length)
      throw Error(
        'Listing returned no vacancy links; source structure may have changed',
      );
    const info = paginated
      ? readDiscoveryInfo(source as DiscoverySource, html)
      : null;
    const guard = new DiscoveryPageGuard();
    guard.accept(links);
    const rememberPage = async (
      url: string,
      pageLinks: { externalId: string; url: string }[],
    ) => {
      await discoverItems(source, pageLinks);
      await db().query(
        `INSERT INTO source_discovery_pages(source_id,url,signature,item_count) VALUES($1,$2,$3,$4)
        ON CONFLICT(source_id,url) DO UPDATE SET signature=excluded.signature,item_count=excluded.item_count,observed_at=now()`,
        [source, url, listingFingerprint(pageLinks), pageLinks.length],
      );
    };
    await rememberPage(listUrl, links);
    const countQuality = info
      ? assessReportedTotal(config.reported_total, info.reportedTotal, {
          value: config.reported_total_candidate,
          firstSeen: config.reported_total_first_seen,
          lastSeen: config.reported_total_last_seen,
          observations: config.reported_total_observations || 0,
        })
      : null;
    if (countQuality)
      await db().query(
        `UPDATE sources SET quality_warning=$2,reported_total_candidate=$3,reported_total_first_seen=$4,reported_total_last_seen=$5,reported_total_observations=$6 WHERE id=$1`,
        [
          source,
          countQuality.warning,
          countQuality.candidate,
          countQuality.firstSeen,
          countQuality.lastSeen,
          countQuality.observations,
        ],
      );
    if (info && !countQuality?.hold)
      await db().query(
        'UPDATE sources SET reported_total=$2,reported_pages=$3,discovery_observed_at=now() WHERE id=$1',
        [source, info.reportedTotal, info.totalPages],
      );
    // The full HR search is authoritative for discovery; its sitemap is only a fallback.
    const sitemap = info?.totalPages ? null : activeConfig.sitemap;
    let discoveryWarning = countQuality?.warning || '';
    // A source whose shape or coverage looks different needs a person; a single failed
    // fetch that the backoff will retry does not.
    let discoveryStructural = Boolean(countQuality?.warning);
    const pageBudget = Math.max(
      1,
      Math.min(50, Number(process.env.DISCOVERY_PAGE_BUDGET) || 20),
    );
    const extraPages = countQuality?.hold
      ? []
      : paginated
        ? planDiscoveryPages(
            source as DiscoverySource,
            info!,
            config.discovery_cursor,
            pageBudget,
          ).urls
        : [
            ...new Set(
              Array.from({ length: 3 }, (_, offset) =>
                additionalListing(source, html, config.sitemap_cursor + offset),
              ).filter((url): url is string => !!url),
            ),
          ];
    if (paginated && !info?.totalPages) {
      discoveryWarning =
        'Listing page count is unavailable; first page retained and discovery will retry';
      discoveryStructural = true;
    }
    for (const extra of extraPages) {
      try {
        const pageLinks = listLinks(
          source,
          await sourceFetch(source, extra),
          extra,
        );
        const accepted = guard.accept(pageLinks);
        if (accepted !== 'accepted') {
          discoveryWarning =
            'Pagination returned ' +
            accepted +
            ' page; cursor retained for retry';
          discoveryStructural = true;
          break;
        }
        await rememberPage(extra, pageLinks);
        links.push(...pageLinks);
        await db().query(
          paginated
            ? 'UPDATE sources SET discovery_cursor=discovery_cursor+1 WHERE id=$1'
            : 'UPDATE sources SET sitemap_cursor=sitemap_cursor+1 WHERE id=$1',
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
    if (sitemap) await discoverItems(source, unique);
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
    let attempted = 0;
    for (const item of [...pending.slice(0, newCount), ...existing].slice(
      0,
      limit,
    )) {
      if (Date.now() - startedAt > 16 * 60 * 1000) {
        budgetExhausted = true;
        break;
      }
      attempted++;
      try {
        const data = await completeDescription(
          parseDetail(source, await sourceFetch(source, item.url), item.url),
          item.raw,
          item.failures,
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
        if (outcome === 'quality_held') qualityHeld++;
      } catch (e) {
        if (
          (e instanceof SourceHttpError && [404, 410].includes(e.status)) ||
          e instanceof UnavailableVacancy
        ) {
          removed++;
          consecutiveDetailFailures = 0;
          await db().query(
            "UPDATE source_items SET last_checked_at=now(),error=$2,quality_candidate=NULL,quality_signature=NULL,quality_warning=NULL,quality_first_seen=NULL,quality_last_seen=NULL,quality_observations=0,next_check_at=now()+interval '7 days' WHERE id=$1",
            [item.id, e.message],
          );
          if (item.job_id)
            await db().query(
              "UPDATE jobs SET needs_review=true,version=version+1 WHERE id=$1 AND NOT needs_review AND status IN ('pending','published')",
              [item.job_id],
            );
          if (item.job_id)
            await transaction((c) => reconcileJob(c, item.job_id));
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
        qualityHeld
          ? `${qualityHeld} detail snapshots held for quality review`
          : null,
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
    const operationalWarning =
      [
        discoveryWarning === countQuality?.warning ? null : discoveryWarning,
        failed ? `${failed} detail pages failed` : null,
      ]
        .filter(Boolean)
        .join('; ') || null;
    // Individual pages fail transiently and retry with backoff; that is a degraded run, not a
    // broken source. Only a changed listing shape, an aborted batch or a mostly-failing batch
    // means the check itself did not succeed.
    const structural = structuralFailure({
      discoveryWarning,
      discoveryStructural,
      stoppedEarly,
      failed,
      attempted,
    });
    const unresolvedQuality = Number(
      (
        await db().query(
          'SELECT count(*)::int AS count FROM source_items WHERE source_id=$1 AND quality_warning IS NOT NULL',
          [source],
        )
      ).rows[0].count,
    );
    const qualityWarning =
      [
        countQuality?.warning,
        unresolvedQuality
          ? `${unresolvedQuality} detail snapshots held for quality review`
          : null,
      ]
        .filter(Boolean)
        .join('; ') || null;
    await db().query('UPDATE sources SET quality_warning=$2 WHERE id=$1', [
      source,
      qualityWarning,
    ]);
    await db().query(
      "UPDATE sources SET last_success_at=CASE WHEN $3::text IS NULL THEN now() ELSE last_success_at END,last_error=$2,consecutive_failures=0,next_run_at=now()+(interval_minutes*interval '1 minute') WHERE id=$1",
      [source, operationalWarning, structural],
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
      budgetExhausted,
      qualityHeld,
      warning,
      structural,
    };
  } catch (e) {
    const error = (e as Error).message.slice(0, 500);
    const deferred = deferredSourceFailure(source, error);
    if (started) {
      await db().query(
        'UPDATE source_runs SET status=$7,finished_at=now(),error=$2,discovered=$3,imported=$4,changed=$5,failed=$6 WHERE id=$1',
        [
          runId,
          error,
          discovered,
          imported,
          changed,
          failed,
          deferred ? 'deferred' : 'failed',
        ],
      );
      await db().query(
        "UPDATE sources SET last_error=$2,consecutive_failures=consecutive_failures+1,next_run_at=now()+CASE WHEN $3 THEN interval '1 day' ELSE (LEAST(1440,interval_minutes*power(2,LEAST(consecutive_failures,5)))*interval '1 minute') END WHERE id=$1",
        [source, error, deferred],
      );
    }
    return { source, error, deferred };
  } finally {
    if (locked) await lock.query('SELECT pg_advisory_unlock($1)', [lockId]);
    lock.release();
  }
}
