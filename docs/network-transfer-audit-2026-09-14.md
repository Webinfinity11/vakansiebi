# Database network-transfer audit — 2026-09-14

JOBX exhausted Neon's former 5 GB free egress allowance. Database storage and egress are different: repeatedly returning an unchanged description spends transfer again. No `pg_stat_statements` history is installed on this database, so the precise attribution of the historical 5,598,921,094 bytes to individual queries cannot be recovered. The findings below establish costly code paths and measure current JSON payloads; they do not claim a provider-billed traffic breakdown.

## Findings and changes

- The previous source reconciliation selected up to 500 jobs regardless of whether anything changed. Each reconciliation loaded both draft and published JSON, plus complete source-item rows. The earlier `5e6bd53` change restricted periodic reconciliation to changed, unchecked, expired or daily-due candidates. Immediate reconciliation after imports remains in place.
- The admin panel fetched up to 30 complete job records, associated source snapshots and metadata every 10 seconds, including in background tabs. It now polls at most once per minute while visible and not editing/busy. Manual refresh and post-mutation refresh are unchanged. Periodic requests fall from 360/hour to 60/hour while idle and visible, and to zero while hidden. Historical open-tab duration is unknown.
- Reconciliation now transfers identical draft/published text once, reconstructing the original object using PostgreSQL jsonb equality. Distinct editorial drafts, null publication and quality gates are preserved. Unused source-item fields, especially quality-candidate snapshots, are omitted from importer/reconciliation responses.
- The detail queue no longer preloads ordinary descriptions or quality candidates. Only the prior description, logo and URL needed to reuse verified employer text are included. The importer still reads the complete raw vacancy under lock for quality assessment. New-item ordering, retries and the time budget are unchanged.
- Employer rows now group repeated name/logo/city/source attributes in PostgreSQL and retain every job ID and count. The existing ten-minute process cache remains. Public API edge caching was checked live: a repeated identical list request changed from MISS to HIT. Private/admin responses remain private.
- The Mac government worker now respects source due times and failure backoff rather than forcing each source every 30 minutes. Cloud government polling was already removed because those hosts are unreachable there.

## Measured before/after payloads

Read-only aggregates were calculated within PostgreSQL; vacancy text was not downloaded for this audit. `scripts/audit-database-transfer.ts` reproduces these estimates with bounded samples and a 30-second statement timeout.

| Query path | Sample | Before bytes | After bytes | Reduction |
|---|---:|---:|---:|---:|
| Reconciliation job snapshot | 500 published jobs | 6,896,779 | 3,385,055 | 50.9% |
| Existing source-item queue | 200 items | 1,351,341 | 387,670 | 71.3% |
| Employer directory | 11,338 job memberships / 7,066 groups | 2,097,275 | 1,550,080 | 26.1% |

These are serialized row payload estimates, excluding PostgreSQL protocol/TLS overhead. They are not additive percentages and are not a forecast of total egress reduction. CPU time, database storage, provider billing and third-party scraping traffic are separate metrics. Source HTTP fetches do not themselves consume Neon egress; reading stored source snapshots does.

## Operational safeguards

Neon only for the live site and workers. Compute range 0.25–0.5 CU, five-minute idle suspension, matching project defaults. $16/$20 organization spending alerts are configured; these alert and do not stop billing. Cloud source runs retain 200-record / eight-minute / three-discovery-page budgets and at most two simultaneous source jobs. Government runs retain 100-record / five-minute / three-page budgets. New vacancies keep priority; reducing admin/recheck transfer does not delay new imports until a daily batch.

Avoid repeated full database exports and broad live backfills. The one-off recovery backup is distinct from ordinary application traffic. Database integration tests use isolated local PostgreSQL fixtures, not production records. Future operational checks should query aggregate counts and byte totals rather than exporting job/source JSON.

## Validation

Type checking and relevant PostgreSQL integration tests cover publication, distinct editor drafts, source refresh, quality holds, employer identity, and compact projections. Queue tests preserve verified employer text, omit unused candidate snapshots, and assert payload reduction. Additional build/deployment verification is recorded by the release that ships this audit.

Remaining: historical query-level egress is unavailable; real post-release usage needs an elapsed billing window. A ten-minute per-process employer cache can still be rebuilt by separate cold server instances. Do not promise that these changes alone impose a dollar cap or guarantee a particular monthly bill.
