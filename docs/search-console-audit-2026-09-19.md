# JOBX Search Console investigation — 2026-09-19

Inspected the authenticated Chrome session for `sc-domain:jobx.ge` directly, around 15:19–15:30 Asia/Tbilisi. These observations are distinct from local tests and user-agent simulations.

## Confirmed observations

- Submitted `https://jobx.ge/sitemap.xml`: Unknown, Couldn't fetch, zero discovered pages; list has no last-read date. Detail view gives only “Sitemap could not be read”, without an HTTP or XML parsing error.
- Google Live URL Test of that exact sitemap succeeded at 15:19: “URL is available to Google” and “Page can be indexed”. This is a fetch check, not proof of sitemap ingestion or a reason to request indexing of the XML file.
- Homepage `https://jobx.ge/`: “URL is on Google”, “Page is indexed”. Last crawl September 18, 22:37:32, Googlebot smartphone. Crawl allowed Yes; Page fetch Successful; Indexing allowed Yes. User and Google-selected canonicals match the homepage.
- Homepage Discovery → Sitemaps: **Temporary processing error**. Referring pages include current search URLs and a legacy `/post_tag/standard-post/` URL.
- Page indexing report: “Processing data, please check again in a day or so.” Property added to this account September 18; this does not establish the domain's age.
- robots.txt report: HTTP and HTTPS copies both Fetched on September 18, 94 bytes, no issues.
- Crawl stats (last updated September 17): 23 requests, 128 ms average, host had no problems. 61% 301, 35% 404, 4% 200. This is a small historical sample, not today's request distribution.
- 404 examples include `/mansional/2056/602425` and other unrelated paths. That example still correctly returns HTTP 404 for a Googlebot user agent. These paths are absent from application code. Their provenance is unconfirmed; they are not evidence of a current compromise or a proven cause of the sitemap issue. Do not redirect nonexistent pages to the homepage.
- Manual actions: No issues detected. Security issues: No issues detected.
- Breadcrumbs: 9 valid, 0 invalid, no critical issues.
- Job Postings: 3 valid, 0 invalid. Optional warnings: streetAddress, addressRegion, postalCode, employmentType, baseSalary (3 each), addressLocality (2). Do not invent missing job facts to silence these warnings. They do not explain XML sitemap fetch status.
- Seventeen available sitemap-related Vercel requests in the one-hour log sample returned 200, including requests at the Live Test time. The logs sampled do not establish the identity of every requester or cover every historic fetch.
- Public DNS and Google Public DNS agree on A record 216.150.1.1; no AAAA record returned.

## Actions completed

1. Previously published commit `a5986101e808060b71c9f151011786512e4cc9b7` keeps `/sitemap.xml` discovery available when URL generation throws: returns the existing section index with HTTP 200 and no-store, instead of 503. Seven sitemap tests, typecheck and lint passed. Production health confirmed that revision. This resilience fix is not a proven explanation of the Console error and cannot prevent every infrastructure timeout or section outage.
2. Resubmitted `https://jobx.ge/sitemap.xml` through the authenticated Sitemaps UI. Google confirmed “Sitemap submitted successfully”.
3. Submitted the existing database-independent `https://jobx.ge/sitemap-index.xml` as an alternate discovery route. Google confirmed submission. At the observation time it also showed Unknown / Couldn't fetch / zero pages. Submission success is not processing success.

## Interpretation and next action

Current evidence supports a sitemap processing/discovery delay over a reproducible XML, robots, canonical, or general host-access defect. Low crawl demand is a possible contributor, not a verified cause. The successful Live Test does not exercise every path of Google's separate sitemap processing system. The exact internal cause remains unconfirmed.

Keep the URLs stable and allow Google to process the submissions. Recheck Last read, sitemap Type, discovered pages and specific error details after 24–48 hours as an operational follow-up, not a guaranteed Google deadline. If unchanged, use the evidence above in a Search Console support/community investigation; correlate any new concrete HTTP error with Vercel logs. Avoid repeated deployments, deletion/recreation of the property, fabricated structured data, or repeatedly renaming/resubmitting the sitemap.

Official reference: https://support.google.com/webmasters/answer/7451001 (fetch troubleshooting includes low crawl demand and requires a Live URL Test).
