# JOBX Search Console investigation and SS.ge comparison — 2026-09-20

Observed directly in the authenticated Search Console UI at approximately 13:04–13:15 Asia/Tbilisi. This is distinct from simulated Googlebot HTTP requests.

## Findings

- Domain property and HTTPS URL-prefix property both show Unknown / Couldn't fetch for submitted sitemaps. Changing property type does not resolve this observation.
- Google's Live URL Tests succeeded for `/sitemap-pages.xml` (13:06), `/sitemap.xml` (13:07), and `/sitemap-index.xml` (13:09): “URL is available to Google”. The pages sitemap's expanded result explicitly says crawl allowed Yes, page fetch Successful, indexing allowed Yes.
- The index sitemap's historical inspection also records a successful Googlebot smartphone fetch on September 19 at 18:20:49. XML files need not be indexed as search-result pages.
- Homepage is indexed. Last crawl September 19 at 22:17:06; fetch successful; crawl/indexing allowed; Google-selected canonical agrees with the inspected homepage.
- Homepage Discovery → Sitemaps explicitly says **Temporary processing error**.
- Page indexing report says “Processing data, please check again in a day or so.”
- Property added to this account September 18. This is not evidence of the domain's registration date or complete ownership history.
- Crawl stats, last updated September 18: 164 requests, 412 ms average, 2.16 MB downloaded. Host had no problems. Responses: 76% HTTP 200, 15% HTTP 301, 9% HTTP 404. The prior September 19 local audit recorded 23 requests in an older reporting window; this is evidence that reporting/crawling is progressing, not a controlled speed comparison.
- HTTP and HTTPS robots.txt reports: Fetched, 94 bytes, no issues. Current robots.txt permits public crawling and names `/sitemap.xml`.
- Manual actions and Security issues: **No issues detected**.
- Breadcrumbs: 12 valid, zero invalid. Job Postings: 3 valid, zero invalid. Optional address/employment/salary warnings remain; they are not sitemap parsing failures and missing facts must not be invented.
- Old unrelated `/mansional/...` paths appear among 404 examples. Their origin is unconfirmed; no current compromise or sitemap error is established by these historical URLs.
- Vercel active custom WAF configuration: null, draft null, no config versions. This does not independently rule out every platform-level mitigation.
- Available last-day Vercel sitemap sample: 29 requests, all HTTP 200. The sample is not proof of all historic requests or crawler identities.
- Public main sitemap before today's change: valid XML, 2,926 unique same-origin URLs, no individual vacancy URLs. Main endpoint and both originally submitted section/index URLs returned HTTP 200.

## Actions

1. Submitted the existing canonical `https://jobx.ge/sitemap.xml` once because the domain property's visible list initially contained only `sitemap-index.xml` and `sitemap-pages.xml`. Google confirmed “Sitemap submitted successfully”; the list still showed Couldn't fetch afterward. Submission acceptance is not ingestion success.
2. Ran Google's live tests and checked robots, canonical, host health, manual actions, security, rich results, and both property variants.
3. Restored public vacancy URLs to the combined main sitemap and linked their existing `/vacancies/sitemap.xml` section from the fallback/static index. Existing public/grouped vacancy filtering, canonical URL generation, edge caching, streaming, and failure fallback remain in use. This addresses discovery coverage, not a proven cause of Google's processing error.

## SS.ge comparison

Public sources inspected:
- https://jobs.ss.ge/robots.txt — points to https://ss.ge/sitemap-jobs.xml
- https://ss.ge/sitemap-jobs.xml — XML index with 56 entries in this sample
- https://ss.ge/ka/jobs/sitemap-listing-0.xml — 200 listing/filter URLs in this section
- https://ss.ge/ka/ads/61 — 86 individual vacancy URLs in this section, pointing to `https://jobs.ss.ge/ka/details/...`
- https://jobs.ss.ge/ka — descriptive page title, description, canonical, profession/filter links and employer navigation

The useful transferable pattern is discovery of both relevant listing pages and individual vacancies. JOBX already has filtered landing pages, employer pages, canonical URLs and JobPosting markup; its vacancy sitemap had been disconnected from the submitted discovery path. SS.ge's private Search Console, traffic and internal crawl budget were not accessed; no claim is made that its sitemap reports are error-free.

Infinity comparison is pending: the accessible Google account lists only JOBX properties. The user was asked to open Infinity's property and identify its domain. No Infinity findings have been inferred.

## Interpretation and next checkpoint

Evidence supports a Google sitemap processing/discovery issue over a currently reproducible HTTP/XML/robots/WAF/canonical defect. The exact Google-internal cause is not exposed. Low crawl demand is a possible explanation, not a verified diagnosis. Other properties succeeding does not establish that this property's processing has completed.

Keep sitemap URLs stable. Recheck Last read, Type and discovered-page counts after processing; September 22 is a practical follow-up checkpoint, not a promised Google completion time. If unchanged, provide these live-test timestamps and “Temporary processing error” evidence to Google's support/community. No support message has been sent.

Official references:
- https://support.google.com/webmasters/answer/7451001?hl=en — troubleshooting, live fetch tests, processing status and low crawl demand
- https://status.search.google.com/ — no general incident listed at observation time (September 20, 01:55 PDT update); this does not exclude a property-specific issue
