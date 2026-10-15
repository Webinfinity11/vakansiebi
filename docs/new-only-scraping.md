# New-only scraping

The catalogue is populated. From activation onward, scheduled collection discovers
new IDs, downloads each new detail once, and publishes valid vacancies dated today
or up to four days before in Asia/Tbilisi (2026-10-15: widened from two days, so a few
missed runs do not lose postings). Unknown, invalid, future and older
publication dates are not imported. Discovery time never substitutes for a source date.

Known IDs cause no snapshot writes or detail requests. Completed IDs remain remembered
even when an expired job is purged. The recent pending queue permits at most three
failed attempts; unavailable pages stop immediately. Historical description repairs
are not part of the scheduled cycle. New vacancies can still fetch the linked employer
text during their initial import.

Each source cycle retires unprocessed records outside the three-day discovery window
and records whose three attempts are exhausted. Their IDs remain stored, so later listing
discovery cannot resurrect them. Admin queue and due counts use the same eligibility
rules as the worker, excluding completed and retired records.

Listing discovery begins at page one instead of rotating through the archive. It stops
after two consecutive pages introduce no new IDs, or at the configured page/time budget.
This keeps a second page for promoted/pinned listings. Listing order and pagination
limits still affect coverage; a long outage can miss announcements outside the three-day
window. Sources without a listing date require one detail request to establish age.

Existing vacancies stay visible until their stored deadline; there is no seven-day
reverification requirement. Expiry uses stored data and sends no source request.
No deadline is invented for undated expiry fields. Later edits on sources are
intentionally not synchronized; early removals are, by a daily listing walk (below).

## Activation

Stop running collectors, deploy the worker change and apply
`033_new_only_scraping.sql` before restarting collection. The migration disables the
pre-switch pending queue and clears old repair requests without deleting jobs or IDs.
Do not apply it while an old worker is running. Publish website changes only via the
repository's deployment workflow. Release authorization was received on September 20, 2026. Verify the migration and live revision during rollout.

Cards now show source publication date and deadline separately, using semantic time
attributes. The release also includes crawlable pagination and search analytics improvements.

## Listing order (2026-10-15)

hr.ge is read with its publish-date filter (`pdf=<window start>`), so only the window is
listed, newest first. jobs.ss.ge is read with `sortBy=OrderDate_desc`; it sorts by date inside
each paid tier (VIP 3, VIP 1, ordinary), so discovery walks through paid tiers and stops in
the ordinary tier at the first page dated wholly before the window or after two pages with
nothing new. hr.ge and jobs.ss.ge cards carry their posting day as a listing hint; a card dated
before the window is not stored and its detail is never fetched. Before this change the default
orders spread new postings over all pages and about a fifth of hr.ge and two fifths of
jobs.ss.ge postings were found (reports/coverage-2026-10-15.md).

## Early removals (2026-10-15)

Once a day per board (jobs.ge, hr.ge, jobs.ss.ge), at the end of a run, the whole listing is
walked — list pages only, no detail requests (`worker/removal-sweep.ts`). A walk counts only if
it saw at least 95% of the board's reported total (jobs.ge, which reports none: 90% of the
previous walk). An imported vacancy missing from one complete walk is remembered
(`source_items.missing_since`); missing again from a complete walk at least 20 hours later, its
item is marked `Source vacancy unavailable` and the usual reconciliation archives the job as
`removed`, unless another board still lists it. Reappearing clears the mark. Cost: jobs.ge
19 pages at its 5-second crawl delay, hr.ge 35 pages, jobs.ss.ge ~176 pages, about six minutes a
day in total.
