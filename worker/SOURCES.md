# Source adapters

Active read-only public HTML adapters, verified with live probes on 2026-09-07:

| ID           | Listing                                                                                     | Detail extraction                                                                                     | Discovery                                                                |
| ------------ | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| hr           | https://www.hr.ge/                                                                          | Matched public announcement state + visible description                                               | Front page + rotating sitemap document                                   |
| jobs         | https://jobs.ge/ge/ads/                                                                     | Labelled vacancy table                                                                                | Listing page                                                             |
| ss           | https://jobs.ss.ge/ka/l/vacancies                                                           | Matching public detail state; excludes job-seeker listings                                            | Front page + three rotating listing pages                                |
| hrgov        | https://vacancy.hr.gov.ge/                                                                  | Matching vacancy ID + labelled public form                                                            | Front page + three rotating listing pages                                |
| gancxadebebi | Vacancy category of the classified board                                                    | Matching public `GEO` id inside the advertisement container                                           | Category page + three rotating pages                                     |
| worknet      | https://worknet-api.moh.gov.ge/api/Vacancy/All (public JSON of the state employment agency) | Matching id in the public detail JSON; only active, non-cancelled records                             | First page + rotating pages, newest first                                |
| awork        | https://awork.ge/sitemap-vacancy.xml                                                        | Vacancy-matched canonical URL + SSR title, company, description, labelled fields and dates            | Complete vacancy sitemap, newest IDs first; disabled by default          |
| myjobs       | https://api.myjobs.ge/api/ka/public/vacancies/v2 (public JSON)                           | Matching id in the public detail JSON or the SSR page's `__NEXT_DATA__`; only `active`                | First page + rotating pages                                              |
| dk           | https://recruting.dkcapital.ge/api/public/vacancy/v2/search (public JSON behind v.dk.ge)    | Matching id in `get_by_id`; only `published`, not deleted                                             | First page + rotating pages; disabled by default                         |
| jobtl        | https://job.tl/?ajax=jobs&page=1&city=All (JSON with an HTML fragment)                      | schema.org JobPosting whose URL carries the same id + `.description` block                            | First page + rotating pages; disabled by default                         |
| joob         | https://joob.ge/ + WordPress day archives `/YYYY/MM/DD/`                                    | Body `postid-N` must equal the requested `?p=N`; BlogPosting date/section + labelled Elementor fields | Home page, then today, yesterday and the day before; disabled by default |
| unijobs      | https://unijobs.ge/wp-json/wp/v2/job_listing (public WordPress REST)                        | Same API by id; only `publish`, not filled                                                            | One page of 100, newest first; disabled by default                       |
| liberty      | https://www.libertybank.ge/ka/kariera/mimdinare-vakansiebi                                  | Matching canonical ID; official description, region, schedule and deadline                            | One inline JSON list; disabled by default                               |

Liberty Bank (2026-10-29): the public Georgian careers page supplies 60 vacancy IDs in
`window.vacancies` JSON. The adapter parses that data without executing JavaScript and
fetches details only on the bank's own two hostnames. Both the listing ID and the detail
canonical must match. The full description and application contact are retained; no
third-party employer attachment is fetched, including during manual refreshes. Robots
allows these public pages; the shared request delay and response limits apply.

The source provides a deadline, but no publication date. Its source-specific import rule
accepts an otherwise verified official vacancy with a valid, unexpired deadline and keeps
`datePosted` empty. It does not treat discovery as publication or relax the five-day rule
for other sources. Existing IDs remain immutable under the current new-only policy;
deadline extensions on the same ID require a separate refresh. Migration 065 adds the
source with discovery and publication disabled. No production activation is implied.

`www.hr.gov.ge` redirects to the home page even for detail URLs. The public-service adapter uses the canonical `vacancy.hr.gov.ge` host directly. Myjobs was investigated but its vacancy listing did not expose usable server-rendered vacancy links; it is not advertised as a supported source.

The worker respects robots.txt, host allowlists, request delay and bounded response size. There are no authenticated endpoints, browser automation, anti-bot bypasses or notifications. Each run imports a bounded batch, sharing capacity with due rechecks and filling unused quota from the backlog. Listing pagination rotates gradually; discovery is not instantaneous or exhaustive.

Sources with auto_publish enabled publish validated records and refresh automatically managed drafts/public snapshots. Explicit editorial edits pause automation for that job. Missing/invalid data is retried without requiring manual review; transient failures preserve the last verified snapshot for up to seven days. Published expiry remains enforced by the public query.

Only explicit currency/pay periods are normalized. Public-service salary has no period assumed. SS currency enum 1 was verified as GEL; other currencies are conservatively unpriced. Jobs.ge client banners can belong to unrelated advertisers; only images explicitly labelled with the matching employer are used. HR and SS logos come from vacancy-specific containers/data.

Read-only smoke check:

```sh
npm run source:probe -- --source=ss --save
```

The optional `--save` stores probes only under ignored `.local/probes/`.

Bounded existing snapshot refresh, with source advisory locks (also reconciles publication when source automation is enabled):

```sh
npx tsx scripts/refresh-source-details.ts --limit=3 --source=hr
```

Omit `--source` to refresh a maximum of three existing records per supported source. Automatic source publication also applies to this refresh command.

Use `--job=<vacancy UUID>` with `--source=ss --limit=1` for a bounded recheck of a reported vacancy, through the same source lock and quality/publication rules.

SS contact extraction verified on 2026-09-10: public phone controls expose the vacancy-bound `phones` entries on click without login. Import requires a matching application ID and a corresponding visible full/masked phone control. Emails must match a public mailto, displayed contact button, or Cloudflare email-protection element decoded by the page. Company/user profile contacts remain excluded. The labelled visible experience field is retained in facts. Example 88240596 verified with public phone, email, and experience; previously the description-only extraction missed this separate contact block.

Samushao.ge is retired at the owner’s request. Active configs, CLI, HTTP fetch and source selectors exclude it. Migration004 disables collection and archives vacancies exclusively associated with it. Historical parsing fixtures/audit data remain for compatibility; there is no active network path to that source.

SS pagination uses the public SSR totalCount and page size because visible links only show neighbouring pages. Each source run visits up to three additional listing pages, with the cursor retained in PostgreSQL. GitHub batches process up to 200 details per source within an 8-minute budget; the backlog drains gradually and still shares capacity with existing-record rechecks. The admin-controlled economical mode caps routine rechecks according to each source's published population and schedule, with extra capacity for verification older than five days. Full mode retains the previous fill-the-batch behavior. New-item priority and time/rate limits apply to both modes. Run metrics distinguish new attempts, old-record rechecks, unchanged results and linked duplicates; records predating migration 031 have no detailed measurements.

Verification on 2026-09-09: the SS page-72 URL returned 13 vacancy links, confirming distant-page discovery against the live source. Government connectivity checks on standard GitHub Linux, Windows and macOS runners all timed out, including the official alternate www.hr.gov.ge host. A local bounded government run successfully imported 78 new vacancies and identified 18 HTTP 404 pages. This local fallback does not establish independent cloud collection for the government source; a reachable hosting network is still required. HR's interval was temporarily 30 minutes during recovery; all active sources now default to 3 hours to control resource use.

Full-description refresh (2026-09-10): the worker follows vacancy-specific public links to Helio, SmartRecruiters, Awork, Selfrecruit, Hirehive, Liberty and Softgarden. Jobs.ge links to the English version require the same vacancy ID. Employer text is appended in full to the original source description; the summary is supplementary. Vacancy identity, public URL, response size and host allowlists are checked. An inaccessible/mismatched linked page fails the refresh and retains the previous snapshot; it is never replaced with a partial response. Public government sections are retained without a fixed label whitelist. No applicant forms are submitted or applicant data imported.

`npx tsx scripts/queue-description-refresh.ts` previews the current public catalogue. `--apply` queues a fresh HTTP fetch for every current primary source. This explicit maintenance request allows old paused publications to resume source updates after successful validation, unless an editor changed the job after the request. The scheduled worker processes these requests before discovery, with durable completion/error tracking. `npx tsx scripts/reprocess-descriptions.ts --source=jobs --limit=500` runs a bounded batch directly. Apply database migrations before running the new worker.

Gancxadebebi (2026-09-11): only the vacancy category is collected. The neighbouring job-seeker, student-work, remote-work and internship categories of the same board are excluded by requiring that category segment in the detail URL. Cv.ge was examined and rejected: its sitemap is tenant 2 of the same `api.p.hr.ge` platform as hr.ge, and 31 of 31 sampled announcements resolve to the same id and slug on hr.ge, so it carries no vacancy hr.ge does not already have. Myjobs.ge remains client-rendered, serves no robots.txt, and exposes no vacancy links in server HTML.

These advertisements carry no employer entity, only a contact inside the text. The quality guard therefore accepts an empty company for this source, the duplicate fingerprint includes the advertisement URL so two unrelated private posts sharing a title and city never pair up, and the public catalogue labels them instead of showing a blank employer. Cross-source automatic merging already ignores records without a company. Automatic publication is enabled, as for the other active sources; migration 012 records that decision.

## Review of 2026-09-12: throughput, completeness, new boards

Politeness is enforced per host by a serialised queue (`hostTurn` in `worker/http.ts`): the large boards get one request a second, the small government and classified sites two seconds, and a robots.txt `Crawl-delay` replaces the gap rather than adding to it. Jobs.ge asks for five seconds, which is why it was the slowest source; nothing can change that except running more hours. Details are processed by three workers at once (`DETAIL_CONCURRENCY`), which overlaps host waits with database writes and employer-site fetches; requests to one host never overlap. `SCRAPE_BUDGET_MINUTES` (default 22) bounds a run, `CRAWL_BATCH_SIZE` caps it at 1000.

New postings are fetched newest first; rechecks start with records missing from the listings for 36 hours. hr/jobs/ss re-read a detail daily instead of every six hours (migration 013), a withdrawn record is re-confirmed at 7, 14, 28, 56 and then 112-day intervals, and a verified employer link is re-read about every third day while the source text is unchanged (`linkedRefreshDue`); an explicit description refresh always re-reads it.

Jobs.ge is discovered through its category listings with the vacancy-only filter (`jid=1`): tenders, trainings and scholarships no longer enter the queue, and every row carries the source category (`კატეგორია` fact) and the work location from the listing. The site-wide VIP block that repeats on every category page is not attributed to a category. Jobs.ss.ge's public sphere becomes the `სფერო` fact and the catalogue category; hr.ge's public benefits, languages, driving licences and student suitability become facts. The catalogue taxonomy grew to 15 categories and the title classifier was rewritten (`worker/categories.ts`); the source's own classification wins when it has one. `npx tsx scripts/reclassify-categories.ts` previews the new classification for records already stored and `--apply` writes it, without fetching any source; only automatic, unpaused records whose title is unchanged are touched.

Worknet (Ministry of Health employment agency, 9,707 active records on 2026-09-12) and myjobs.ge (723) are read from their public, unauthenticated JSON. Public vacancy URLs identify records and are what the catalogue links to; `detailRequestUrl` maps them to the JSON actually fetched. `worknet-api.moh.gov.ge` answers 401 for robots.txt, which RFC 9309 treats as "no restrictions" (the site's own robots.txt allows everything); `api.myjobs.ge` allows everything. Worknet's region names are not public: the city comes from the free-text street, then from a small region map justified by sampled streets. Worknet employer tax ids and contact persons are never stored.

Neither government host is in the GitHub matrix: vacancy.hr.gov.ge times out from every runner (2026-09-09) and so does worknet.moh.gov.ge (2026-09-12, run 34701274010, `UND_ERR_CONNECT_TIMEOUT`). Myjobs.ge does work from the cloud: its first cloud run imported 326 records and emptied its queue. `scripts/install-local-gov-sources.sh` registers a launchd agent on this Mac that runs hrgov and worknet every 3 hours when due; advisory locks keep it from overlapping with the workflow.

Rejected on 2026-09-12: chefs.ge and doctor.ge are hr.ge tenants; saqme.ge redirects to ss.ge; csogeorgia.org, unjobs.org, jooble, UNDP and devex sit behind Cloudflare challenges; hh.ru's API is forbidden and its HTML asks for a 60-second crawl delay; TBC's SmartRecruiters API host disallows all crawling in robots.txt. Candidates that work but were not added yet: joob.ge (WordPress classifieds, ~60 posts a day, no deadline field), teacherjobs.ge (school vacancies, site being rebuilt), and employer boards on HireHive (Bank of Georgia), Manatal (Credo) and Liberty Bank's inline JSON.

Awork (2026-09-21): `enabled=false`, `auto_enabled=false`, interval 180 minutes. The host allowlist is in its module config; the shared HTTP default supplies a two-second gap. Yearless dates follow the existing jobs.ge convention (future publication day means previous year; a deadline before publication rolls into the next year). Sitemap lastmod is never used as publication date. Missing pay periods and deadlines are not invented. The GitHub scrape matrix is unchanged.

v.dk.ge (2026-09-24): Kenchadze.Jobs, a Vue app over a public JSON API whose robots.txt allows everything; 145 published vacancies. `enabled=false`, `auto_enabled=false`, interval 180 minutes (migration 039). Salary follows the site's three display forms (average earnings, range, fixed) with no pay period assumed; `EndDate` is not displayed by the site and equals the posting day, so no deadline is stored. CV counters, user ids and payment fields are not read. The GitHub scrape matrix is unchanged until the source is enabled.

job.tl (2026-09-24): 34 vacancies, twelve a page; robots.txt is empty. batumijob.com is the same board filtered to Batumi (its 14 ids are job.tl's Batumi list), so it has no adapter. Dates, employer and city come from the JobPosting block, the full text from `.description`; any slug ending in the id redirects to the canonical address. `enabled=false`, `auto_enabled=false` (migration 040). Rivo.ge was examined and not added: the sampled recent listings are copies of jobs.ge (`source_url` points there) and its own postings are a few a week.

joob.ge (2026-10-15): WordPress private-advertisement board, ~70 posts a day, strongest of the checked boards on day labour (40–100 ₾ a day). The REST API answers 401; robots.txt allows the home page, day archives and posts. Records are identified by the WordPress post id (`data-post-id` on every card; `/?p=N` redirects to the post). The home page holds the newest 82; a day archive holds all posts of that day on one page (72 on 2026-10-14), so four listing pages cover the import window. No employer entity (employerless like gancxadebebi), no deadline. The bare pay field ("65 ₾") is used only when the text carries no pay line, and then without a period. A live sample of 21 posts on 2026-10-15 parsed without error. jober.ge was examined and rejected: same GEO ids and the same 2,352 total as gancxadebebi.ge. moedani.online (newest post Oct 2025) and demontaji.ge (one company's service page) are not boards worth adding. unijobs.ge was added the same day (below). `enabled=false`, `auto_enabled=false` (migration 052).

unijobs.ge (2026-10-15): WP Job Board Pro over a public REST API (robots.txt allows it); 53 active, ~2 a day, all fitting one page. `/?p=N` redirects to the vacancy. Employer, city, type, deadline, logo and the apply link are structured. The pay field prints "$" on every vacancy (a barista at "1500$ - 2500$"), so it is not used; pay written in the text is read as usual. `enabled=false`, `auto_enabled=false` (migration 053). hrgeorgia.ge was examined and not added: 62 active, none posted after 29 September 2026, so the new-only collector would find nothing.

## Audit: 2026-10-28 (read-only production and public pages)

This section supersedes the historical operating-policy descriptions above. Collection is
new-only: today plus four preceding Tbilisi calendar days. Completed source IDs are not
refreshed or revived. `refreshDescriptions` still fetches explicitly queued details, but
`stageVacancy` returns `unchanged` for an existing job/raw snapshot; it is not a repair
mechanism for old content. No production writes, backfill, schedule changes or source
activation were performed in this audit.

The table's imports are `sum(source_runs.imported)` for runs since 2026-10-24 00:00
Asia/Tbilisi, not the number of currently live postings dated within that window. Historical
run counters and current retained source rows need not agree. Success times below are UTC.

| Source       | Last success | Imports | Public evidence and finding                                                                                                                                                                                                                                                                                                                                                               |
| ------------ | ------------ | ------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| hr           | Oct 27 22:14 |     409 | All five filtered pages: 403 current-window IDs, 353 already imported, 50 unseen and dated Oct 28. No older missing ID in this comparison. Two detail samples parse correctly.                                                                                                                                                                                                            |
| jobs         | Oct 27 22:23 |     799 | First six pages: 852 unique current-window IDs, 604 imported and 49 unseen (all Oct 28); remaining known IDs include pending work. Queue has 203 actionable items since Oct 26. Last runs imported 92/85 and both exhausted the eight-minute budget. Parsing works; throughput needs an owner-approved capacity decision.                                                                 |
| ss           | Oct 22 08:47 |       0 | Eight consecutive failures; last error HTTP 403. This Mac reads listing/detail pages successfully. 2,170 reported listings, 167 pages. Seven sampled pages contain 64 recent IDs, 40 unseen. Pages 55/56 each contain 13 recent IDs, beyond production's 40-extra-page cap. Runner access and capacity need separate investigation/approval.                                              |
| hrgov        | Oct 28 07:46 |      39 | Production success is newer than the old geo-blocking briefing. No repeat network/runner investigation; one detail failure recorded in the window.                                                                                                                                                                                                                                        |
| worknet      | Oct 28 07:48 |      91 | Production reports 10,608 records; recent successful run, one detail failure in window. No repeat geo-blocking investigation.                                                                                                                                                                                                                                                             |
| myjobs       | Oct 27 22:17 |       4 | API parses; first page 10/10 already imported. API reports about 4,502 entries (not necessarily active-only). First three pages contain 30 IDs, 27 known. Old published ID 24733 now returns 404; no removal sweep for this source.                                                                                                                                                       |
| gancxadebebi | Oct 27 15:22 |       3 | First page 30/30 imported; two details parse. Empty employer/deadline are intentional for these private advertisements.                                                                                                                                                                                                                                                                   |
| awork        | Oct 27 15:21 |      25 | Sitemap 311/311 IDs imported; two details parse, newest sampled date Oct 23. Enabled in production despite historical disabled-default documentation.                                                                                                                                                                                                                                     |
| dk           | Oct 27 22:14 |      14 | First page 21 IDs, 18 known, 17 imported; three unseen IDs. Two details parse, including new Oct 28 ID 5467. Missing deadline is intentional because the API's EndDate is not the displayed closing date.                                                                                                                                                                                 |
| joob         | Oct 27 22:16 |     219 | Five day archives contain 249 unique IDs, 219 known. Home page contains pinned older posts, so it is not a newest-ID guarantee. Fixed archive count to derive from the five-day import window. Production still allows only three extra pages; full recovery across all five days requires a capacity decision and review of known/repeated-page early stopping for independent archives. |
| jobtl        | Never        |       0 | Disabled. First page 12 IDs, two details parse; newest sampled date Oct 26. Activation is not part of this audit.                                                                                                                                                                                                                                                                         |
| unijobs      | Never        |       0 | Disabled. Listing 56 IDs, eight dated within window; two details parse. Activation is not part of this audit.                                                                                                                                                                                                                                                                             |

Removal verification checked two recent published records per active non-government scraper,
plus older published and `removed` samples for hr/jobs/ss/myjobs. HR removed IDs 494990 and
494785 return 410; jobs IDs 755013 and 755014 are unavailable. SS removed IDs 88251318 and
88203279 now return vacancies with future deadlines (Nov 26 and Nov 16); they may have been
reposted under the same IDs. SS published ID 88221549 now closes Nov 26 while the stored
snapshot closes Oct 28. These demonstrate the limitation of immutable IDs; they do not by
themselves prove the original removal decision was wrong. Myjobs published ID 24733 returns
404, demonstrating a gap for sources without removal sweeps. No automatic resurrection or
historical snapshot rewrite was added: those conflict with the existing new-only policy and
need an explicit decision.

Fixed a separate removal safety defect: missing page-count metadata, exceeding the 400-page
cap, empty intermediate pages, and repeated pages now invalidate the entire walk before any
missing/removal writes. Previously an unknown page count became one page, and an empty page
silently ended the walk; count tolerance could then authorize incomplete evidence. The
existing 20-hour/two-walk rule and all scheduling/capacity settings are unchanged.

No stored parsed snapshot has an empty title. Empty companies occur only on the two intended
employerless boards; missing deadlines occur there and on dk. Recent source-item errors in the
five-day discovery window are two unavailable jobs.ge records. Across all history, item error
counts are hr 980, jobs 2,803, ss 298, hrgov 140, myjobs 104, gancxadebebi 34, worknet 3; these
include confirmed removals and must not be presented as current parser failures.

Duplicate audit: 673 published fingerprint groups contain 1,475 records, but fingerprints are
only candidates. Fifteen recent cross-source pairs all fail the deliberate `samePosting`
exact-content/date/facts checks; no false automatic merge was demonstrated. All window run
metrics report zero linked duplicates. Relaxing identity checks or bulk merging was not done.

Validation: 63 parser/discovery/new-only/quality/removal tests pass, including local
`ertad_test` integration tests. Removal regressions cover missing metadata, repeated/empty
pages and cap overflow, with unchanged job status and missing state after rejected walks.
This is a bounded audit, not an exhaustive live crawl of every source or an assertion that
all remaining vacancies are synchronized.

## SS HTTP 403 investigation: 2026-10-28

**Confirmed execution path.** Production SS runs in GitHub Actions, not the dormant Railway
configuration. [Run 40593158518, SS job 122502309719](https://github.com/Webinfinity11/vakansiebi/actions/runs/40593158518/job/122502309719)
logs Ubuntu 24.04.5, Azure `centralus`, and the 403 at 2026-10-27 22:18:02 UTC.
`lib/server/scraper-github.ts` dispatches this workflow. Railway's `vakansiebi` project has a
`scraper` service, but the deployment API returned no deployments; `railway.worker.toml`
is a configuration file, not evidence of an executing worker. No Railway resource changed.

The [last successful SS job](https://github.com/Webinfinity11/vakansiebi/actions/runs/39748975067/job/119724473777)
on Oct 22 also ran in Azure `centralus`, discovered 481 and imported 41. The
[first failing job](https://github.com/Webinfinity11/vakansiebi/actions/runs/39796260770/job/119884152101)
later that day ran in `northcentralus` and failed approximately 2.6 seconds after starting
the worker, before discovery/detail processing. The relevant HTTP, discovery, adapter and
workflow files have no diff between these two runs' commits. The Oct 27 failure occurs in
`centralus` again. A permanent block on every datacenter IP is therefore **not established**;
IP reputation, a changed WAF policy, geolocation, and client fingerprint remain hypotheses.

**Actual request.** `worker/http.ts` uses Node fetch with explicit
`User-Agent: ErtadVacancyBot/0.1` and
`Accept: text/html,application/xml,text/xml,text/plain`, manual redirects, a 25-second timeout,
no explicit Cookie, Authorization, Referer or Accept-Language, and at least one second between
SS request starts. The three detail workers do not run before initial discovery succeeds.
Robots currently allows `/` and declares no crawl delay. The initial route is
`https://jobs.ss.ge/ka/l/vacancies?sortBy=OrderDate_desc&page=1`.

**Local controlled checks.** On the same Mac/network, six sequential requests spaced at least
1.2 seconds apart all returned 200: robots, exact production listing request, listing without
query parameters, the listing with HTML/XHTML Accept and `Accept-Language: ka,en;q=0.8`, the
listing with honest descriptive `JobxVacancyBot/0.1 (+https://jobx.ge)` identification, and a
known detail URL. Responses say `server: cloudflare`, include TBS `cf-ray`, and contain normal
Next.js data, not a challenge. Existing headers already work here, so these observations do
**not** prove that different headers repair GitHub access.

**Challenge attribution is unresolved.** Production's `rawFetch` discards response headers;
`SourceHttpError` preserves only the status. Neither GitHub log contains the blocked body,
`cf-ray`, `cf-mitigated` or `Retry-After`. Cloudflare is confirmed in the serving path, but that
does not identify whether the 403 came from its challenge/WAF or from the origin. Cloudflare
[documents `cf-mitigated: challenge`](https://developers.cloudflare.com/cloudflare-challenges/challenge-types/challenge-pages/detect-response/)
as its challenge-page marker. Capturing it on the failing runner is needed; no CAPTCHA,
clearance-cookie acquisition, proxy rotation or browser impersonation was attempted.

| Candidate                                           | Evidence                                                                                                                                                                                                     | Cost and recommendation                                                                                                                                                                                                                    |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Better Accept/Accept-Language or descriptive bot UA | Local variants all 200, as is the original; effectiveness on GitHub unproven                                                                                                                                 | Tiny implementation cost, but do not ship as a confirmed fix. Compare one variable at a time on the failing runner first.                                                                                                                  |
| Slower request starts / reduced detail concurrency  | First failure precedes detail processing and happens within seconds; 403 persists across days                                                                                                                | Weak hypothesis for this incident. Would reduce coverage; leave timing and concurrency unchanged. No 429 or Retry-After evidence was preserved.                                                                                            |
| Public Next.js data route                           | `/_next/data/PJ65mWWK3rMZt2JM5Za6y/ka/l/vacancies.json?sortBy=OrderDate_desc&page=1` returns 200 JSON locally with `pageProps` and `__N_SSP`; decoded response length 142,558 versus HTML 421,922 characters | Potentially cheaper transfer, but same Cloudflare host, changing build ID and different parser input. GitHub success unproven; not a ready fix or replacement for detail fetching.                                                         |
| Frontend API gateway                                | Public JS names `jobs-gateway.ss.ge`; its robots.txt is 200 with `Disallow: /`                                                                                                                               | Rejected for this worker; no search request made. `jobs-api.ss.ge` also appears in JS and robots returns 404, but a supported unauthenticated search contract was not verified; do not adopt an undocumented origin route as a workaround. |
| Existing reachable Georgian machine                 | Unchanged bot requests work on this Mac; government collection already has a reachable execution path                                                                                                        | Zero new VPS, but moving SS is a separate operational decision, not a demonstrated header fix. No worker invocation or schedule change was made.                                                                                           |

**Cheapest next step:** a bounded, read-only diagnostic on a GitHub Ubuntu runner, with no
DATABASE_URL or import command: read robots, make the exact listing request, then compare the
header variant / unfiltered route / public data route at a conservative gap. Record status,
final hostname/path, server, cf-ray, cf-mitigated, Retry-After, content type and a sanitized
challenge marker/title only; never cookies or credentials. This can discriminate request
shape from network policy without adding infrastructure. Current `source-connectivity.yml`
is fixed to government URLs on macOS and has no URL input; dispatching it cannot answer this
SS question. Adding a one-off SS diagnostic requires an owner-reviewed workflow change;
none was made or dispatched here. No currently proven header/rate/endpoint fix exists from
these observations alone.

### Implemented after owner selection: safe diagnostics and SS JSON fallback

The owner selected implementation instead of a separate GitHub diagnostic workflow. The
worker now records the first 403/429/5xx diagnostic of each source run in the existing
`source_runs.error`, including when JSON recovers an HTML 403 (a partial, recovered run).
Fields are status, bounded server/cf-mitigated/cf-ray/content-type and up to 200 whitespace-free
characters of sanitized error-page text. Scripts, form values, attributes, credential-like
values, known environment secrets and URLs are removed. Cookie/Set-Cookie/Authorization
headers are never copied. HTTP 404/410 messages retain their exact old removal semantics.

Only SS HTML 403 initiates the fallback. Build IDs come from successful public page HTML or
same-origin Next data/manifest links; a cold process tries `/ka` and the unfiltered listing,
at most once per hour, sharing bootstrap work between concurrent requests. JSON requests keep
the original locale, path, page and sort query and obey the same robots rules, source host
allowlist, rate delay, timeout and response-size cap. Listings retain the existing date hints,
VIP-tier handling and count parsing. Details require the matching vacancy ID and jobsDealType.
JSON never invents visible phone/email controls, so those separately controlled HTML contacts
are omitted when their visibility cannot be verified. No gateway/origin API is used.

A JSON 404 permits one bounded build refresh; any failed or malformed fallback preserves the
original HTML 403, never a false vacancy-removal signal. If all public bootstrap HTML is also
blocked and no build ID has been observed, fallback cannot proceed; diagnostics still survive.
No discovery/detail limits, import window, source schedules, production data or infrastructure
were changed. Local live verification compared one HTML detail with its public Next JSON:
title, description, posting date and deadline match. This does not prove GitHub egress works.
