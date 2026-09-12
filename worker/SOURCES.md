# Source adapters

Active read-only public HTML adapters, verified with live probes on 2026-09-07:

| ID | Listing | Detail extraction | Discovery |
| --- | --- | --- | --- |
| hr | https://www.hr.ge/ | Matched public announcement state + visible description | Front page + rotating sitemap document |
| jobs | https://jobs.ge/ge/ads/ | Labelled vacancy table | Listing page |
| ss | https://jobs.ss.ge/ka/l/vacancies | Matching public detail state; excludes job-seeker listings | Front page + three rotating listing pages |
| hrgov | https://vacancy.hr.gov.ge/ | Matching vacancy ID + labelled public form | Front page + three rotating listing pages |
| gancxadebebi | Vacancy category of the classified board | Matching public `GEO` id inside the advertisement container | Category page + three rotating pages |
| worknet | https://worknet-api.moh.gov.ge/api/Vacancy/All (public JSON of the state employment agency) | Matching id in the public detail JSON; only active, non-cancelled records | First page + rotating pages, newest first |
| myjobs | https://api.myjobs.ge/api/ka/public/vacancies (public JSON) | Matching id in the public detail JSON or the SSR page's `__NEXT_DATA__`; only `active` | First page + rotating pages |

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

SS pagination uses the public SSR totalCount and page size because visible links only show neighbouring pages. Each source run visits up to three additional listing pages, with the cursor retained in PostgreSQL. GitHub batches process up to 300 details per source within a 22-minute budget; the backlog drains gradually and still shares capacity with existing-record rechecks.

Verification on 2026-09-09: the SS page-72 URL returned 13 vacancy links, confirming distant-page discovery against the live source. Government connectivity checks on standard GitHub Linux, Windows and macOS runners all timed out, including the official alternate www.hr.gov.ge host. A local bounded government run successfully imported 78 new vacancies and identified 18 HTTP 404 pages. This local fallback does not establish independent cloud collection for the government source; a reachable hosting network is still required. HR's admin interval is now 30 minutes to drain its discovered backlog faster.

Full-description refresh (2026-09-10): the worker follows vacancy-specific public links to Helio, SmartRecruiters, Awork, Selfrecruit, Hirehive, Liberty and Softgarden. Jobs.ge links to the English version require the same vacancy ID. Employer text is appended in full to the original source description; the summary is supplementary. Vacancy identity, public URL, response size and host allowlists are checked. An inaccessible/mismatched linked page fails the refresh and retains the previous snapshot; it is never replaced with a partial response. Public government sections are retained without a fixed label whitelist. No applicant forms are submitted or applicant data imported.

`npx tsx scripts/queue-description-refresh.ts` previews the current public catalogue. `--apply` queues a fresh HTTP fetch for every current primary source. This explicit maintenance request allows old paused publications to resume source updates after successful validation, unless an editor changed the job after the request. The scheduled worker processes these requests before discovery, with durable completion/error tracking. `npx tsx scripts/reprocess-descriptions.ts --source=jobs --limit=500` runs a bounded batch directly. Apply database migrations before running the new worker.

Gancxadebebi (2026-09-11): only the vacancy category is collected. The neighbouring job-seeker, student-work, remote-work and internship categories of the same board are excluded by requiring that category segment in the detail URL. Cv.ge was examined and rejected: its sitemap is tenant 2 of the same `api.p.hr.ge` platform as hr.ge, and 31 of 31 sampled announcements resolve to the same id and slug on hr.ge, so it carries no vacancy hr.ge does not already have. Myjobs.ge remains client-rendered, serves no robots.txt, and exposes no vacancy links in server HTML.

These advertisements carry no employer entity, only a contact inside the text. The quality guard therefore accepts an empty company for this source, the duplicate fingerprint includes the advertisement URL so two unrelated private posts sharing a title and city never pair up, and the public catalogue labels them instead of showing a blank employer. Cross-source automatic merging already ignores records without a company. Automatic publication is enabled, as for the other active sources; migration 012 records that decision.

## Review of 2026-09-12: throughput, completeness, new boards

Politeness is enforced per host by a serialised queue (`hostTurn` in `worker/http.ts`): the large boards get one request a second, the small government and classified sites two seconds, and a robots.txt `Crawl-delay` replaces the gap rather than adding to it. Jobs.ge asks for five seconds, which is why it was the slowest source; nothing can change that except running more hours. Details are processed by three workers at once (`DETAIL_CONCURRENCY`), which overlaps host waits with database writes and employer-site fetches; requests to one host never overlap. `SCRAPE_BUDGET_MINUTES` (default 22) bounds a run, `CRAWL_BATCH_SIZE` caps it at 1000.

New postings are fetched newest first; rechecks start with records missing from the listings for 36 hours. hr/jobs/ss re-read a detail daily instead of every six hours (migration 013), a withdrawn record is re-confirmed at 7, 14, 28, 56 and then 112-day intervals, and a verified employer link is re-read about every third day while the source text is unchanged (`linkedRefreshDue`); an explicit description refresh always re-reads it.

Jobs.ge is discovered through its category listings with the vacancy-only filter (`jid=1`): tenders, trainings and scholarships no longer enter the queue, and every row carries the source category (`კატეგორია` fact) and the work location from the listing. The site-wide VIP block that repeats on every category page is not attributed to a category. Jobs.ss.ge's public sphere becomes the `სფერო` fact and the catalogue category; hr.ge's public benefits, languages, driving licences and student suitability become facts. The catalogue taxonomy grew to 15 categories and the title classifier was rewritten (`worker/categories.ts`); the source's own classification wins when it has one. `npx tsx scripts/reclassify-categories.ts` previews the new classification for records already stored and `--apply` writes it, without fetching any source; only automatic, unpaused records whose title is unchanged are touched.

Worknet (Ministry of Health employment agency, 9,707 active records on 2026-09-12) and myjobs.ge (723) are read from their public, unauthenticated JSON. Public vacancy URLs identify records and are what the catalogue links to; `detailRequestUrl` maps them to the JSON actually fetched. `worknet-api.moh.gov.ge` answers 401 for robots.txt, which RFC 9309 treats as "no restrictions" (the site's own robots.txt allows everything); `api.myjobs.ge` allows everything. Worknet's region names are not public: the city comes from the free-text street, then from a small region map justified by sampled streets. Worknet employer tax ids and contact persons are never stored.

vacancy.hr.gov.ge is no longer in the GitHub matrix (it times out from every runner). `scripts/install-local-gov-sources.sh` registers a launchd agent on this Mac that runs hrgov and worknet every 30 minutes when due; advisory locks keep it from overlapping with the workflow.

Rejected on 2026-09-12: chefs.ge and doctor.ge are hr.ge tenants; saqme.ge redirects to ss.ge; csogeorgia.org, unjobs.org, jooble, UNDP and devex sit behind Cloudflare challenges; hh.ru's API is forbidden and its HTML asks for a 60-second crawl delay; TBC's SmartRecruiters API host disallows all crawling in robots.txt. Candidates that work but were not added yet: joob.ge (WordPress classifieds, ~60 posts a day, no deadline field), awork.ge (sitemap + SSR detail), teacherjobs.ge (school vacancies, site being rebuilt), and employer boards on HireHive (Bank of Georgia), Manatal (Credo) and Liberty Bank's inline JSON.
