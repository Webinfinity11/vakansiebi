# Google vacancy notifications

Search Console API reads search performance and the indexed version of individual URLs. Indexing API announces new or changed pages containing supported `JobPosting` structured data. Enabling Search Console API alone does not deliver vacancy notifications.

The Google service account must own the `sc-domain:jobx.ge` Search Console property. Enable both APIs in the service account's Google Cloud project. Keep `GOOGLE_INDEXING_CLIENT_EMAIL` and `GOOGLE_INDEXING_PRIVATE_KEY` in GitHub Secrets. The public website does not need a copy of these secrets.

Apply `050_google_indexing_queue.sql` before releasing the publication changes. New and edited supported publications enqueue within the same database transaction; a rollback leaves no notification. Google is contacted only after commit. Publishers without Google credentials retain the event for the separate delivery workflow.

The scraper tries immediate delivery. `.github/workflows/google-indexing.yml` retries due notifications every 30 minutes, including admin and local-worker publications. GitHub schedules can be delayed. The workflow checks the queue and budget before installing dependencies and does not deploy the website.

The database reserves the daily quota atomically using America/Los_Angeles midnight, including daylight saving time. The default is 200 requests per day. Failures after a reservation still count because a timed-out request may have reached Google. At the limit, notifications remain pending until the next Pacific day. Temporary failures use exponential backoff up to six hours; bad requests remain visible as rejected. Concurrent workers lease each event, and a response for an older revision cannot mark an edited revision delivered. Unsupported, expired, test and archived jobs do not spend update quota. Archival continues to rely on page removal/noindex and the sitemap; it does not compete with new publications for quota.

Authenticated administrators can read `/api/admin/indexing` for queue counts, the most recent delivery and today's attempt count. A `sent` record means Google accepted the notification, not that it indexed the page. Inspect actual indexing with Search Console URL Inspection.

For an explicit bounded recovery, run `npx tsx scripts/google-indexing-recover.ts --recent=50 --id=UUID` against the intended database. This previews eligible URLs; add `--apply` to enqueue. Identical queued content is not duplicated. Delivery still obeys the shared quota. `--recent=0` limits recovery to explicit IDs. Never send all historical vacancies or raise the configured quota without Google's approval.

Submit `https://jobx.ge/sitemap.xml` in Search Console. It is an index of four independently cached files: pages, categories, companies and jobs. Indexing API applies to vacancy details only; category and company pages are discovered through the sitemap and internal links. HTTP 200 from Indexing API permits Google to recrawl; it cannot guarantee indexing or its timing.

References: [Indexing API usage](https://developers.google.com/search/apis/indexing-api/v3/using-api), [quota and approval](https://developers.google.com/search/apis/indexing-api/v3/quota-pricing), [Search Console sitemap submission](https://developers.google.com/webmaster-tools/v1/sitemaps/submit).
