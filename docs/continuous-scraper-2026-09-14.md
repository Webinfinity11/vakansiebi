# Scraper scheduler and database quota incident — 2026-09-14

The existing GitHub schedule was delayed for hours. A long-running Jobs.ge cycle
also blocks other sources in the old sequential continuous runner.

`node --import tsx worker/continuous.ts` polls eligible source IDs every 30 seconds
and runs at most three source processes concurrently. Each child retains the
existing source advisory lock, due check, quality validation, automatic publication,
request spacing, and failure backoff. A source cannot run twice in this scheduler.
A failed or skipped child has a 60-second cooldown; stuck children have a 32-minute
watchdog. Shutdown stops new work and terminates remaining children after 20 seconds.
`/health` requires a database poll within two minutes. There is no public domain.

Only enabled, non-retired adapters can run. Manual requests and explicit description
repairs are supported independently of automatic discovery. Samushao is excluded.
Suggested bounded production settings: CRAWL_BATCH_SIZE=200,
SCRAPE_BUDGET_MINUTES=8, DISCOVERY_PAGE_BUDGET=3, DETAIL_CONCURRENCY=3.

## Egress reduction

The old reconciliation sweep downloaded up to 500 complete jobs and source records
twice per source invocation, even when nothing changed. It now selects unchecked
jobs, jobs changed since the check, source items checked since the job check, expired
published vacancies, or active/pending jobs whose daily check is due. Unchanged
archived records are excluded. New imports still call `reconcileJob` immediately.
This reduces redundant transfers; it does not reset a hosting quota.

## Incident and deployment status

Neon project `plain-sky-34116949` rejected database connections with SQLSTATE 53000:
“Your project has exceeded the data transfer quota.” Its API reported 5,598,921,094
bytes transferred and 239,812,608 bytes of storage, on free_v3. The consumption
period ends 2026-10-01T00:00:00Z. jobx.ge/api/health also returned unavailable.
This is an access suspension, not a deletion of database contents. Individual query
contributions have not been measured; the redundant sweep is a verified contributor,
not a proven complete attribution of the quota usage.

An empty Railway project/service was created while preparing continuous hosting:
project f5b9a33b-5849-4880-bb39-dc3fc18c4892, environment
54f12ae8-135b-40e8-a9df-bc860a788ed9, service
af5252f8-b92b-43b9-bc1d-531fadb9be0d. **No code was deployed and no paid upgrade
was enabled.** The user explicitly requires restoration without payment.
The attempted config-path mutation was rejected because Railway now requires IaC
for new config assignments. The worker TOML is for the existing legacy setup;
new Railway hosting needs a supported configuration before deployment.
The local government loop was stopped while the database is unavailable.

A September 9 local JSON backup contains 427 jobs and 5,154 source items; this
does not contain all of the roughly 10,000 current live vacancies. The September 7
local PostgreSQL database has 57 jobs. Neither has replaced production. A complete
current recovery cannot be claimed from these backups. An alternative free hosting
account is needed before migration and fresh imports can be verified.

## Validation

Type checking passed. Scheduler tests cover concurrency, failure cooldown/retry,
and draining shutdown. A PostgreSQL test with temporary tables verifies disabled and
retired sources are excluded, manual and repair requests are retained, unchanged
records are skipped, and changed/expired/new records remain eligible.
The full suite passed 212 tests with 14 optional database tests skipped; the new
database scheduling test additionally passed against local PostgreSQL.
