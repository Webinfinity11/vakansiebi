# Scraper scheduling and admin control QA — 11 September 2026

## Root cause and correction

GitHub's scheduled workflow was active and ran while the computer was offline (including run 34563031652 at 04:39 UTC). All four sources had automatic discovery enabled. The worker nevertheless skipped discovery whenever it attempted a description repair, even when all those repairs failed. The same 23 unresolved employer links therefore starved HR, Jobs and SS discovery on every invocation.

`runSourceCycle` gives repairs a bounded 20-item / 3-minute turn and then runs due discovery. Source pause/due checks still apply. Repair failures remain visible as warnings and queued records; hard infrastructure errors still fail. Discovery partial results are still reported as partial/failed Actions jobs, not hidden.

Live GitHub verification: run 34572209988 on commit 7683386 imported 72 HR vacancies and 74 SS vacancies after repair failures. Jobs discovery also resumed. HR Gov remains subject to its existing network timeout and retry backoff; this change does not claim to fix government connectivity. The 23 old employer-link failures remain pending, with no fabricated replacement text.

## Admin behavior

- Per-source enabled, discovery and automatic-publication controls; 30-minute to 24-hour target intervals.
- All-source queue request and automatic discovery pause/resume.
- Last activity/result, next eligible check, repair backlog, explicit source errors and latest GitHub run link.
- Pending repair retry button; source configuration persists in Neon.
- Optional server-only GitHub dispatch, pinned to this repository/workflow/main. Admin session and origin checks retained. Database advisory lock and 60-second cooldown prevent duplicate concurrent dispatches.
- Without a dispatch token, requests remain durable and the interface explicitly says they await the next scheduled GitHub run. Production direct dispatch remains unconfigured until a restricted GitHub credential is supplied; no broad CLI credential was copied to Vercel.

## Validation

- 112 tests passed against the isolated `/ertad_test` database, including retry starvation, paused discovery, shutdown/infrastructure error behavior, fixed GitHub destination, missing/rejected credentials and simultaneous dispatch coalescing.
- Typecheck, lint and production build passed.
- Browser: real local admin login, sources panel, persisted HR automation off/on (restored on), requested HR check and truthful queued fallback.
- Mobile 390px and 320px: document width equals viewport width. Fixed pre-existing admin statistics and logout header overflow. Desktop panel visually reviewed.
- No vacancy deletion, outgoing application, email or notification was triggered. The manual HR request remains in the normal processing queue.

GitHub scheduling is best effort; the requested 30-minute cron is not a guaranteed start time. Reference: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule
