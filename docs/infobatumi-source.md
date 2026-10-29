# InfoBatumi vacancy source

Verified 2026-10-29. This is a portal carrying multiple employers, including restaurants, hotels, retail and office roles. Public board: https://www.infobatumi.ge/vakansiebi/. Its employer submission offer is at https://www.infobatumi.ge/for-landing/.

The public HTML feed currently exposes all 74 active vacancies. Scope is the vacancy feed, excluding the page's unrelated business, event and apartment feeds. Stable WordPress post IDs use the public `https://www.infobatumi.ge/?p=ID` redirect. Detail identity must match the body post ID and a canonical vacancy URL on the exact source host. Listing count mismatches fail explicitly so future pagination changes cannot silently truncate discovery.

The robots file permits the public pages. Requests use the existing robots-aware worker and its normal per-host delay. No private API, authenticated endpoint or third-party aggregator is used.

Publication dates come from the detail's visible `განთავსებულია … წინ` text. The listing's last-renewed label and `og:updated_time` are not publication dates. The existing four-day lookback is retained; older, undated, closed and expired vacancies do not publish as new. Relative day labels are limited by the precision of the source. The source supplies a day/month deadline; a year is resolved from the publication year, with a December-to-January rollover. No date-of-discovery is substituted.

Pay keeps the source wording. Explicit daily values are classified as daily; a small amount alone does not imply a daily period. Multi-hour amounts such as `8 საათში 45₾` retain the eight-hour period. Real source map coordinates are retained; the portal's name alone never assigns Batumi to a vacancy. Employer/contact content is restricted to the actual vacancy fields, excluding related advertisements.

Activation uses migration `071_infobatumi_source.sql`, which registers the source disabled. After live probing and parser/pipeline tests, enable it with a 180-minute interval, batch limit 100 and an 8-minute budget. The existing new-only collector imports a posting once and follows the shared deduplication, expiry and suppression rules. Website deployment and scraper scheduling remain separate.

Checks: live HTML and worker probe; daily/monthly pay, dates, malformed/offsite identity, closed posting and feed completeness unit tests; isolated PostgreSQL pipeline test for publishing, exclusion and repeat-run idempotence. Production counts are recorded privately under `.local/` at activation.

Other sources considered: HRGeorgia's latest visible postings were in September; Moedani's were from 2025; Biznesebi returned HTTP 403 to ordinary public fetches. These were not activated as fresh new sources.
