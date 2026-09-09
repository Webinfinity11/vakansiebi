# Automatic vacancy lifecycle

GitHub Actions runs the source worker. Neon retains discovery, verified snapshots, retry times, publication and audits; Vercel serves the catalogue. No mail/SMS service or additional server is required for reachable sources.

`sources.auto_publish` explicitly enables automatic publication. Maintenance runs even when a crawl is not due, and again after crawling. It rotates through up to 500 jobs per source with four bounded database tasks at a time.

The shared vacancy schema validates lengths, dates and links. Automatic publication additionally requires an employer, a matching supported source URL, a non-expired deadline, no future publication date and a successful source check within 48 hours. Missing salary, city or logo is left unspecified; values are never invented. Parser-normalized invalid salary ranges remain omitted.

Valid records publish without admin approval. Changed source data updates automatically managed snapshots without bumping their original publication time. Identical records may link to an existing automatically managed published job using the conservative duplicate rules.

Incomplete data remains unpublished without a manual-review task; subsequent successful checks can publish it. Confirmed 404/410 or empty Jobs.ge vacancy templates archive a job when every active provenance source is unavailable. Expired records archive automatically. A transient error preserves the last verified snapshot for up to seven days. The public date filter hides expired vacancies immediately, including between scheduled runs. Reappearing or renewed valid source data can restore automatically archived records.

Explicit admin changes set `automation_paused` for that record. Historical admin edits are protected during migration. Rejected and merged records are never automatically restored. Company profile overrides remain independent. Every automatic state change is audited; diagnostic history stays available without requiring the owner to repair each record.

`last_verified_at` changes only after successful parsing. Failed retries cannot make stale data look freshly verified. Source backoff, robots rules, bounded batches and advisory locks remain in force. Notifications remain disabled.

Government-source network reachability is assessed separately; a green workflow that skips a source is not evidence it can connect. The authenticated Vercel government probe performs one bounded connectivity check without importing or exposing upstream HTML.
