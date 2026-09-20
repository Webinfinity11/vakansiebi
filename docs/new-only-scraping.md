# New-only scraping

The catalogue is populated. From activation onward, scheduled collection discovers
new IDs, downloads each new detail once, and publishes valid vacancies dated today,
yesterday or the day before in Asia/Tbilisi. Unknown, invalid, future and older
publication dates are not imported. Discovery time never substitutes for a source date.

Known IDs cause no snapshot writes or detail requests. Completed IDs remain remembered
even when an expired job is purged. The recent pending queue permits at most three
failed attempts; unavailable pages stop immediately. Historical description repairs
are not part of the scheduled cycle. New vacancies can still fetch the linked employer
text during their initial import.

Listing discovery begins at page one instead of rotating through the archive. It stops
after two consecutive pages introduce no new IDs, or at the configured page/time budget.
This keeps a second page for promoted/pinned listings. Listing order and pagination
limits still affect coverage; a long outage can miss announcements outside the three-day
window. Sources without a listing date require one detail request to establish age.

Existing vacancies stay visible until their stored deadline; there is no seven-day
reverification requirement. Expiry uses stored data and sends no source request.
No deadline is invented for undated expiry fields. Later edits and early removals on
sources are intentionally not synchronized.

## Activation

Stop running collectors, deploy the worker change and apply
`033_new_only_scraping.sql` before restarting collection. The migration disables the
pre-switch pending queue and clears old repair requests without deleting jobs or IDs.
Do not apply it while an old worker is running. Publish website changes only via the
repository's deployment workflow. Release authorization was received on September 20, 2026. Verify the migration and live revision during rollout.

Cards now show source publication date and deadline separately, using semantic time
attributes. The release also includes crawlable pagination and search analytics improvements.
