# Scraper resilience and resource audit — 2026-09-14

## Observed causes

- Production stored 6 classified-ad parsing errors. Two bounded live samples had matching ad identities, real titles and 32-character original descriptions; the common 40-character threshold rejected both. The same threshold existed independently in publication validation, so fixing only the parser would not have published them.
- Worknet repeatedly retained its discovery cursor at page 11. A single live request returned 100 identified records, all with closed status 8. The parser correctly filtered them out, but pagination treated the resulting empty active list as an unreadable response. Its first page continued to run, but discovery behind page 11 never advanced.
- Most stored source-item errors were unavailable advertisements or HTTP 404/410, not scraper failures. These should remain recorded while being counted separately in administration.
- Due discovery previously waited behind up to three minutes of requested description repairs. New vacancies should be handled first.

## Changes

- Permit short original classified descriptions in both parsing and publication validation, confined to the verified board's vacancy category. Matching ad identity and title checks stay in place; empty, punctuation-only and very short unusable bodies remain invalid. No descriptions are padded or invented. Existing quality checks still hold a sudden collapse of previously long descriptions.
- Missing classified-page structure or identifier is a parsing failure, not proof that a vacancy was removed; retain previous data for retry.
- A source adapter may identify a page made entirely of known closed records. Worknet only accepts identified status-8 records as this evidence. Record the page observation and advance the cursor without importing its closed entries. First-page handling also recognizes this condition. The repeated-page fingerprint guard includes these ids; malformed, actually empty and unknown-state pages still stop and retain their cursor.
- Run due discovery/publication before bounded description repairs. Shutdown and infrastructure errors still prevent further work.
- Separate removed advertisements from technical failures in admin source counts; show the removed count in the existing collapsed details.

## Resource limits retained

Three-hour collection cadence; five cloud sources with two concurrent jobs; 200-detail/8-minute/three-extra-page cloud limits; local government 100-detail/5-minute/three-extra-page limits. Repairs keep their own 20-item/three-minute budget. Source rate limits, robots.txt delays, source locks, retry backoff, first-page priority and the 9:1 new/recheck queue remain unchanged. No bulk export or historical rescrape was performed. These are workload bounds, not a guaranteed monthly bill or exact collection latency.

## Validation

71 parser, schema/publication, HTTP, quality, discovery and worker-cycle tests passed. A separate local database schema exercised real worker persistence across closed, first-page-closed, repeated, empty and malformed pagination responses: the cursor advanced only for verified pages, closed records were not imported and the configured two-extra-page test budget was honored. The schema was removed afterward.

The two live classified samples now parse successfully; the sampled Worknet page identifies exactly 100 closed records. These live probes were read-only. Production records retry on their normal next cycle. TypeScript, targeted lint, production build, authenticated admin API checks and desktop/mobile browser checks also passed before release.

## Remaining operational limits

GitHub scheduling can be delayed. Government sources still require this Mac awake. A changed page structure, inaccessible source or changed employer link can still require maintenance; automatic retries are bounded and do not invent data. The worker does not claim zero failures. Stored historical errors are cleared by successful rechecks, not erased to make the dashboard appear healthy.
