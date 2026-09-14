# Scraper audit — 2026-09-14

Priority: discover and publish new vacancies quickly. Historical catalogue recovery is not a goal.

## Confirmed defects fixed

- New-item selection previously treated first-page discoveries and the deeper backlog alike. First-page IDs now take priority, followed by newest discovery time.
- The batch reserved 25% for rechecks but appended them after all new items, so a time-limited run could never reach them. New work now receives 90% of a full batch, scheduled nine new records before one recheck. Rechecks only select currently published jobs; archived historical records do not consume that budget. Unused capacity is available to the other queue.
- Audit-log text truncation used UTF-16 slicing. An emoji crossing the cut point produced an unpaired surrogate, rejected by PostgreSQL JSONB, rolling back the entire import. Truncation now preserves Unicode code points. Reproduced against an SS.ge record (`22P02: Unicode low surrogate must follow a high surrogate`), then successfully imported that same record after the fix.

- Discovery now stores listing hints without rewriting existing vacancy snapshots ahead of new imports. Parsed details still receive the hints. Extra listing-page discovery is limited to the first 20% of the run budget, reserving the remainder for details.

## Operational findings

- GitHub's workflow is enabled with a half-hour schedule, but actual executions have multi-hour gaps. A cron expression is not an execution guarantee. Reliable continuous freshness requires an always-running worker or an independent scheduler; that infrastructure has not been provisioned by this audit.
- Government sources are intentionally excluded from GitHub runners because of network reachability. Their local loop was not running. Both adapters successfully fetched and parsed a live vacancy from this Mac during the audit.
- Gancxadebebi had backed off after connection refusal. It was reachable from this Mac; a bounded live run succeeded.
- Most recorded item errors are withdrawn vacancies (404/410 or source-unavailable), not parser failures. Two SS employer-link mismatches remain guarded rather than importing the wrong vacancy text.
- The jobx.ge deployment has no GITHUB_ACTIONS_TOKEN. Admin requests remain queued until a scheduled run; immediate dispatch from the admin requires a suitably scoped token. The user's broad CLI credential was not copied into the website.

## Verification

Lint and TypeScript passed. 203 tests passed; 13 database integration tests were intentionally skipped. Regression tests cover Unicode truncation and an early-stopped new-first batch. Bounded live runs imported 11 records each from hrgov, worknet and gancxadebebi with no detail failures. Worknet reported an empty pagination page; its cursor was retained for retry, and first-page import succeeded. These runs are limited probes, not evidence of complete source coverage or continuous operation.
