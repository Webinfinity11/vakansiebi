import { nextRunAt } from './next-run';
import { completeDescription } from './linked-description';
import { detailQueue, detailQueueProjection } from './detail-queue';
import { recheckBudget } from './recheck-budget';
import { assessReportedTotal, structuralFailure } from './quality';
import { randomUUID } from 'node:crypto';
import {
  readDiscoveryInfo,
  discoveryListingUrl,
  discoverySources,
  jobsCategoryListingUrl,
  planDiscoveryPages,
  planJobsCategoryPages,
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
  modules,
  detailRequestUrl,
  externalId,
  listLinks,
  parseDetail,
  additionalListing,
  UnavailableVacancy,
  type ListedLink,
} from './adapters';
import {
  sourceFetch,
  validateUrl,
  SourceHttpError,
  deferredSourceFailure,
} from './http';
import { discoverItems, stageVacancy } from './importer';
import {
  acquireSourceLease,
  releaseSourceLease,
  startLeaseHeartbeat,
} from './source-lease';
/** Wall-clock budget for one source run; the workflow's job timeout must stay above it. */
export function runBudgetMs() {
  const minutes = Number(process.env.SCRAPE_BUDGET_MINUTES);
  return Math.max(1, Math.min(300, minutes > 0 ? minutes : 22)) * 60_000;
}
/**
 * Detail pages are processed by a few workers at once. Requests to one host are still
 * spaced by the host queue in http.ts, so the parallelism only overlaps network waits with
 * database writes and with fetches to employers' own sites.
 */
export function detailConcurrency() {
  const configured = Number(process.env.DETAIL_CONCURRENCY);
  return Math.max(1, Math.min(6, configured > 0 ? Math.floor(configured) : 3));
}
export async function runSource(
  source: SourceId,
  limit = Number(process.env.CRAWL_BATCH_SIZE) || 20,
) {
  const activeConfig = getSourceConfig(source);
  const startedAt = Date.now();
  const budgetMs = runBudgetMs();
  const ttlMs = budgetMs + 5 * 60_000;
  const owner = randomUUID();
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  limit = Math.max(1, Math.min(1000, Math.floor(limit) || 20));
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
  let newAttempts = 0,
    recheckAttempts = 0,
    unchanged = 0;
  const metrics = () => ({
    new_attempts: newAttempts,
    recheck_attempts: recheckAttempts,
    unchanged,
    linked,
    removed,
    expired,
    quality_held: qualityHeld,
    budget_exhausted: budgetExhausted,
  });
  try {
    locked = await acquireSourceLease(source, owner, ttlMs);
    if (!locked) return { skipped: true };
    heartbeat = startLeaseHeartbeat(source, owner, ttlMs);
    const config = (
      await db().query('SELECT * FROM sources WHERE id=$1', [source])
    ).rows[0];
    if (!config?.enabled || config.retired) return { skipped: true };
    await db().query(
      "UPDATE source_runs SET status='interrupted',finished_at=now(),error='Worker interrupted; next run retries pending items' WHERE source_id=$1 AND status='running'",
      [source],
    );
    await db().query(
      "INSERT INTO source_runs(id,source_id,run_kind) VALUES($1,$2,'discovery')",
      [runId, source],
    );
    started = true;
    await db().query(
      'UPDATE sources SET last_started_at=now(),requested_at=NULL WHERE id=$1',
      [source],
    );
    const paginated = (discoverySources as readonly string[]).includes(source);
    const listUrl = paginated
      ? discoveryListingUrl(source as DiscoverySource)
      : activeConfig.list;
    const html = await sourceFetch(source, listUrl);
    const links: ListedLink[] = listLinks(source, html, listUrl);
    const firstObserved = links.length
      ? links
      : (modules[source]?.closedListingIds?.(html) || []).map((externalId) => ({
          externalId,
        }));
    if (!firstObserved.length)
      throw Error(
        'Listing returned no vacancy links; source structure may have changed',
      );
    const latestIds = links.map((link) => link.externalId);
    const info = paginated
      ? readDiscoveryInfo(source as DiscoverySource, html)
      : null;
    const guard = new DiscoveryPageGuard();
    guard.accept(firstObserved);
    const rememberPage = async (
      url: string,
      pageLinks: ListedLink[],
      observed = pageLinks.map(({ externalId }) => ({ externalId })),
    ) => {
      // Store hints for parsing, without rewriting historical snapshots before new imports.
      await discoverItems(source, pageLinks, { updateStoredHints: false });
      await db().query(
        `INSERT INTO source_discovery_pages(source_id,url,signature,item_count) VALUES($1,$2,$3,$4)
        ON CONFLICT(source_id,url) DO UPDATE SET signature=excluded.signature,item_count=excluded.item_count,observed_at=now()`,
        [source, url, listingFingerprint(observed), pageLinks.length],
      );
    };
    await rememberPage(listUrl, links, firstObserved);
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
      : source === 'jobs'
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
                  additionalListing(
                    source,
                    html,
                    config.sitemap_cursor + offset,
                  ),
                ).filter((url): url is string => !!url),
              ),
            ];
    if (paginated && !info?.totalPages) {
      discoveryWarning =
        'Listing page count is unavailable; first page retained and discovery will retry';
      discoveryStructural = true;
    }
    // Jobs.ge is discovered through its category listings: the same pages, but each row then
    // carries its category and work location, and the vacancy-only filter keeps tenders and
    // trainings out. The start category rotates so a small budget still covers every category.
    if (source === 'jobs' && !countQuality?.hold && info?.totalPages) {
      const plan = planJobsCategoryPages(config.discovery_cursor, pageBudget);
      let used = 0;
      categories: for (const category of plan.order) {
        if (Date.now() - startedAt >= budgetMs * 0.2) break;
        if (used >= plan.budget) break;
        let pages = 1;
        for (let page = 1; page <= pages && used < plan.budget; page++) {
          if (Date.now() - startedAt >= budgetMs * 0.2) break categories;
          const url = jobsCategoryListingUrl(category.cid, page);
          try {
            const pageHtml = await sourceFetch(source, url);
            used++;
            if (page === 1)
              pages = Math.min(
                50,
                readDiscoveryInfo('jobs', pageHtml).totalPages || 1,
              );
            const pageLinks = listLinks(source, pageHtml, url, {
              categoryLabel: category.label,
              category: category.category,
            });
            const accepted = guard.accept(pageLinks);
            // A small category's first page can repeat what the shared first page already
            // showed; that is not a reason to skip the pages behind it. A repeated or empty
            // page deeper in is this category's end, not a broken source.
            if (accepted === 'empty' || (accepted === 'repeated' && page > 1))
              break;
            if (accepted === 'accepted') {
              await rememberPage(url, pageLinks);
              links.push(...pageLinks);
            }
          } catch (e) {
            discoveryWarning = 'Listing page: ' + (e as Error).message;
            break categories;
          }
        }
        await db().query(
          'UPDATE sources SET discovery_cursor=discovery_cursor+1 WHERE id=$1',
          [source],
        );
      }
    }
    for (const extra of extraPages) {
      if (Date.now() - startedAt >= budgetMs * 0.2) break;
      try {
        const pageHtml = await sourceFetch(source, extra);
        const pageLinks = listLinks(source, pageHtml, extra);
        const closedIds = pageLinks.length
          ? []
          : modules[source]?.closedListingIds?.(pageHtml) || [];
        const observed = pageLinks.length
          ? pageLinks
          : closedIds.map((externalId) => ({ externalId }));
        const accepted = guard.accept(observed);
        if (accepted !== 'accepted') {
          discoveryWarning =
            'Pagination returned ' +
            accepted +
            ' page; cursor retained for retry';
          // A page whose every entry is closed carries no link and is ordinary on a board
          // that keeps expired records in its listing. A page repeating one already read is
          // the pagination itself behaving differently than the source described.
          discoveryStructural = accepted === 'repeated';
          break;
        }
        await rememberPage(extra, pageLinks, observed);
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
    if (sitemap && Date.now() - startedAt < budgetMs * 0.2) {
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
    if (sitemap)
      await discoverItems(source, unique, { updateStoredHints: false });
    discovered = unique.length;
    // Split the budget between backlog and rechecks so neither can starve the other.
    const quota = Math.max(1, Math.ceil(limit * 0.9));
    // Newest postings first: they are what readers look for, and an old backlog entry that
    // has meanwhile expired costs a fetch either way. Rechecks start with records that have
    // dropped out of the listings, the cheapest signal that a vacancy was withdrawn.
    const pending = (
      await db().query(
        `SELECT ${detailQueueProjection} FROM source_items WHERE source_id=$1 AND raw IS NULL AND next_check_at<=now() ORDER BY (external_id=ANY($3::text[])) DESC,discovered_at DESC,id LIMIT $2`,
        [source, limit, latestIds],
      )
    ).rows;
    const population = (
      await db().query(
        `SELECT count(*)::int published,
      count(*) FILTER(WHERE next_check_at<=now() AND (last_verified_at IS NULL OR last_verified_at<now()-interval '5 days'))::int urgent
      FROM source_items WHERE source_id=$1 AND raw IS NOT NULL
      AND job_id IN (SELECT id FROM jobs WHERE status='published')`,
        [source],
      )
    ).rows[0];
    const recheckLimit = recheckBudget(
      config.processing_mode,
      limit,
      population.published,
      config.interval_minutes,
      population.urgent,
    );
    const existing = (
      await db().query(
        `SELECT ${detailQueueProjection} FROM source_items WHERE source_id=$1 AND raw IS NOT NULL AND next_check_at<=now() AND job_id IN (SELECT id FROM jobs WHERE status='published') ORDER BY (last_verified_at IS NULL OR last_verified_at<now()-interval '5 days') DESC,(last_seen_at<now()-interval '36 hours') DESC,next_check_at LIMIT $2`,
        [
          source,
          Math.min(
            recheckLimit,
            Math.max(0, limit - Math.min(pending.length, quota)),
          ),
        ],
      )
    ).rows;
    const newCount = Math.min(pending.length, limit - existing.length);
    let consecutiveDetailFailures = 0;
    let stoppedEarly = false;
    let attempted = 0;
    const queue = detailQueue(pending.slice(0, newCount), existing).slice(
      0,
      limit,
    );
    let next = 0;
    let halt = false;
    const processItem = async (item: (typeof queue)[number]) => {
      try {
        const data = await completeDescription(
          parseDetail(
            source,
            await sourceFetch(source, detailRequestUrl(source, item.url)),
            item.url,
            item.listing_hints,
          ),
          item.raw,
          item.failures,
          { reuseVerified: true },
        );
        const outcome = await stageVacancy(
          item.id,
          data,
          config.detail_interval_hours,
        );
        consecutiveDetailFailures = 0;
        if (outcome === 'imported') imported++;
        if (outcome === 'changed') changed++;
        if (outcome === 'unchanged') unchanged++;
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
          // A withdrawn vacancy is re-confirmed at a growing interval, not every week forever.
          await db().query(
            "UPDATE source_items SET last_checked_at=now(),error=$2,failures=failures+1,quality_candidate=NULL,quality_signature=NULL,quality_warning=NULL,quality_first_seen=NULL,quality_last_seen=NULL,quality_observations=0,next_check_at=now()+(LEAST(112,7*power(2,LEAST(failures,4)))*interval '1 day') WHERE id=$1",
            [item.id, e.message],
          );
          if (item.job_id)
            await db().query(
              "UPDATE jobs SET needs_review=true,version=version+1 WHERE id=$1 AND NOT needs_review AND status IN ('pending','published')",
              [item.job_id],
            );
          if (item.job_id)
            await transaction((c) => reconcileJob(c, item.job_id));
          return;
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
          halt = true;
        }
      }
    };
    const worker = async () => {
      while (!halt) {
        // Measured on 2026-09-11: jobs.ge spends 11 minutes on 70 details because its
        // robots.txt asks for a 5-second gap, while hr/ss spend about 4. An unfinished batch
        // is retained for the next run.
        if (Date.now() - startedAt > budgetMs) {
          if (next < queue.length) budgetExhausted = true;
          return;
        }
        const item = queue[next++];
        if (!item) return;
        attempted++;
        if (item.previously_imported) recheckAttempts++;
        else newAttempts++;
        await processItem(item);
      }
    };
    await Promise.all(
      Array.from(
        { length: Math.min(detailConcurrency(), queue.length) },
        worker,
      ),
    );
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
      'UPDATE source_runs SET status=$2,finished_at=now(),discovered=$3,imported=$4,changed=$5,failed=$6,error=$7,metrics=$8 WHERE id=$1',
      [
        runId,
        warning ? 'partial' : 'success',
        discovered,
        imported,
        changed,
        failed,
        warning,
        metrics(),
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
      'UPDATE sources SET last_success_at=CASE WHEN $3::text IS NULL THEN now() ELSE last_success_at END,last_error=$2,consecutive_failures=0,next_run_at=$4 WHERE id=$1',
      [
        source,
        operationalWarning,
        structural,
        nextRunAt(config.interval_minutes),
      ],
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
    let consecutiveFailures: number | undefined;
    if (started) {
      await db().query(
        'UPDATE source_runs SET status=$7,finished_at=now(),error=$2,discovered=$3,imported=$4,changed=$5,failed=$6,metrics=$8 WHERE id=$1',
        [
          runId,
          error,
          discovered,
          imported,
          changed,
          failed,
          deferred ? 'deferred' : 'failed',
          metrics(),
        ],
      );
      consecutiveFailures = (
        await db().query(
          "UPDATE sources SET last_error=$2,consecutive_failures=consecutive_failures+1,next_run_at=now()+CASE WHEN $3 THEN interval '1 day' ELSE (LEAST(1440,interval_minutes*power(2,LEAST(consecutive_failures,5)))*interval '1 minute') END WHERE id=$1 RETURNING consecutive_failures",
          [source, error, deferred],
        )
      ).rows[0]?.consecutive_failures;
    }
    return { source, error, deferred, consecutiveFailures };
  } finally {
    clearInterval(heartbeat);
    if (locked) await releaseSourceLease(source, owner);
  }
}
