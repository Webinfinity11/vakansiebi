# Import quality and catalogue reset

Parsing happens in the worker, not in the visitor's browser. No new browser dependencies are required.

- Jobs.ge location is read from a labelled work-location line; cities mentioned in company history are not treated as the workplace. Unlabelled locations remain unconfirmed.
- Jobs.ge salary retains the source wording, including bonus and net/gross qualifications. Numeric salary requires a clear amount and currency. The period is never assumed to be monthly.
- HR.ge reversed/invalid salary ranges are withheld. Hidden source salary stays hidden.
- Company names and titles have whitespace normalized. Missing employer/location fields produce moderation warnings.
- HR.ge and SS.ge use their vacancy-specific logo fields. Jobs.ge client images require an exact normalized employer title/alt match. Otherwise the existing initial-letter fallback is used. Editorial company profiles remain authoritative.
- Mailto link recipients in the visible description survive plain-text extraction; hidden CC/BCC recipients are not imported.
- Newly discovered expired listings are recorded for a later check without creating a moderation job. A renewed deadline can make them eligible later. Existing editorial records are not overwritten.
- Samushao remains retired. New jobs require admin approval; no automatic applicant messages are sent.

## Explicit reset

`npx tsx scripts/reset-vacancies.ts --confirm=reset-all-vacancies`

The operator command acquires every source lock and table locks, writes and syncs a private JSON backup in `.local/backups`, and only then deletes all jobs, source items and vacancy-specific audits in one transaction. A running scraper or backup failure aborts the reset. It resets discovery cursors and requests active sources. It preserves company profiles, source configuration, old run history, authentication and local browser application history. The JSON contains full rows for the six backed-up tables and is never committed. Restoring it is a separate maintenance operation requiring foreign-key-aware insertion; this is not a SQL dump.

After resetting, dispatch `.github/workflows/scrape.yml`. Each run imports up to 50 details per source and discovers further pages over later scheduled runs. An empty public catalogue is expected until moderation. Government-source connections from GitHub-hosted runners remain a known network limitation; a local one-shot worker can reach the official source. A GitHub run must not be described as fully successful if a source fails.

Validation: parser regressions, isolated PostgreSQL integration (including expired imports/renewal), reset rehearsal on `ertad_test`, and live read-only samples from HR.ge, SS.ge and Jobs.ge.
