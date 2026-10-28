# Source quality regression checks

## Current new-only policy (verified 2026-10-28)

`stageVacancy` leaves existing `job_id`/`raw` snapshots unchanged. Structural invalidity on a
new item is recorded as a terminal error with `next_check_at=infinity`; it is not retried
automatically. New items require a real source publication date within today plus the four
preceding Tbilisi days. Missing titles/required employers fail validation; the employerless
boards explicitly allow an empty employer. A missing deadline is not invented.

The candidate-confirmation rules below remain implemented by `assessVacancy` and covered by
unit tests, but are historical refresh behavior, not a promise that the current new-only
importer refreshes old snapshots. `refreshDescriptions` cannot bypass that importer guard.
Removal checks apply only to hr/jobs/ss and require a fully traversed, non-repeated listing
within the page cap before count tolerance is considered. Coverage-count warnings do not
remove vacancies. See `SOURCES.md` for the dated live audit and unresolved renewal/coverage gaps.

## Historical refresh quality rules

Source snapshots are never filled with invented fallback values. `quality_candidate` keeps an unaccepted parsed candidate separate from the last good `raw`, `content_hash` and `last_verified_at`. A held import sets a human-readable `quality_warning`, marks manually managed or paused jobs for review (automatic jobs surface the warning in source quality metrics), and retries after30minutes. Network `error` remains separate.

New valid vacancies may have unknown salary, location, logo, employment, or dates. Normal description/title/employer edits proceed. A previously known optional field disappearing is checked again after at least30minutes; two matching observations permit a legitimate removal. Description loss over75% (previous text at least400characters), both title and employer changing, missing closing date, or three missing optional fields require at least three matching observations spanning24hours. A new candidate resets confirmation. Invalid required fields/missing employer never pass automatic confirmation.

A held primary source does not replace its previously verified published snapshot with another source during the existing 7-day verification grace period. Known closing dates still expire normally, and an unverified automatic vacancy is archived after 7 days even if quality confirmation is still pending. Confirmed404/410/unavailable responses clear the quality hold and follow normal removal handling. Once the original data recovers or a valid changed candidate is independently confirmed, warning/candidate state is cleared, normal staging updates verification, and publication automation resumes (respecting manual pause).

Coverage monitoring retains the prior reported total and discovery cursor when an established source count (at least100) drops below50%, or becomes unknown. A second observation after30minutes within10% of the candidate count confirms a legitimate decline. Unknown totals remain unconfirmed. Previously queued details can still be checked; the low count does not delete records. Source `quality_warning` is distinct from `last_error`; run history can be partial with a quality explanation despite successful HTTP.

Limitations: this detects regressions, not semantic truth. A structurally valid, consistently wrong source redesign can eventually satisfy the24-hour confirmation. An individually removed field waits30minutes before disappearing; urgent editorial changes can still be handled manually. Extremely dynamic candidate text can reset confirmation and needs investigation. Counts reflect source listings, not unique cross-source vacancies.
