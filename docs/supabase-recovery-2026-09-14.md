# Supabase recovery preparation — 2026-09-14

The user requires a free replacement while Neon project plain-sky-34116949 is
suspended for transfer quota. Supabase account grubela22@gmail.com was verified
in the browser. Organization JOBX (bvhebscbdhxidwastbkp), Free plan, and project
jobx (ttguucuanoguwlioozno), Frankfurt, were created. Data API was disabled because
JOBX uses PostgreSQL from its server. The user entered the database password.

## Prepared and tested

`scripts/restore-vacancy-backup.ts` reads the version-1 local JSON backup. By default
it only reports eligible rows. `--apply` requires an empty destination and a
migrated schema. It preserves job IDs and linked source-item IDs, excludes expired,
invalid, archived and unsupported-source jobs, and restores eligible jobs as
pending. Source snapshots and verification timestamps are intentionally not copied:
each vacancy must be fetched again before publication. It does not restore the
historical unparsed backlog, audit history, company profiles or old source settings.
The original backup remains intact.

The September 9 backup has 427 jobs. In a separate local PostgreSQL database,
jobx_supabase_restore_check, all 15 migrations applied and 334 eligible jobs were
restored as pending; 93 were excluded. A second application correctly refused the
nonempty database without changing it.

Bounded live imports (20 details per source, first listing page, two-minute budget)
then ran for hr, jobs, ss, hrgov, worknet, myjobs and gancxadebebi. The first six had
zero failed details. Gancxadebebi had one missing-description/structure failure
(GEO1507944), retained for retry and not published. Final local counts: 139 published
and 331 pending. Existing source quality checks and automatic publication were used.
Samushao was not enabled.

A separate Next.js dev server on port 3102, using this local database, returned
HTTP 200 for health, catalogue, vacancy list, keyword search and a vacancy detail
page. Type checking and lint passed for the restore script.

An owner-readable PostgreSQL custom backup is saved locally at
`.local/backups/supabase-recovery-2026-09-14.dump` (public schema, schema_migrations
excluded). The staging connection is in `.local/supabase-staging.env`.

## Still required

No rows have been written to Supabase and production has not been switched.
The Supabase database password is still needed for the database connection.
The local helper `.local/Set-Supabase-Password.command` accepts it without echo
and saves it to an owner-readable `.local/supabase-db-password` file. Do not log it.
The browser's last observed project status was provisioning; verify readiness.

After connection succeeds: verify the exact project, use session-mode pooling for
scraper advisory locks, apply migrations, restore the staged data transactionally
into the empty application tables, verify anon/authenticated cannot read application
tables, test the new connection, update only the relevant Vercel/GitHub/local database
settings, redeploy, and verify jobx.ge. Preserve rollback settings locally.
The current recovery is partial; it does not reproduce all of the unavailable Neon
database. Pending rows become public only after fresh verification.
