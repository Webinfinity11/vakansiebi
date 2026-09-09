# Source adapters

Active read-only public HTML adapters, verified with live probes on 2026-09-07:

| ID | Listing | Detail extraction | Discovery |
| --- | --- | --- | --- |
| hr | https://www.hr.ge/ | Matched public announcement state + visible description | Front page + rotating sitemap document |
| jobs | https://jobs.ge/ge/ads/ | Labelled vacancy table | Listing page |
| ss | https://jobs.ss.ge/ka/l/vacancies | Matching public detail state; excludes job-seeker listings | Front page + three rotating listing pages |
| hrgov | https://vacancy.hr.gov.ge/ | Matching vacancy ID + labelled public form | Front page + three rotating listing pages |

`www.hr.gov.ge` redirects to the home page even for detail URLs. The public-service adapter uses the canonical `vacancy.hr.gov.ge` host directly. Myjobs was investigated but its vacancy listing did not expose usable server-rendered vacancy links; it is not advertised as a supported source.

The worker respects robots.txt, host allowlists, request delay and bounded response size. There are no authenticated endpoints, browser automation, anti-bot bypasses or notifications. Each run imports a bounded batch, sharing capacity with due rechecks and filling unused quota from the backlog. Listing pagination rotates gradually; discovery is not instantaneous or exhaustive.

New records enter moderation. Crawling changes only source snapshots and review flags, never editorial draft or published text. Missing or changed source pages back off and appear as errors; transient failures never delete a vacancy. Published expiry remains enforced by the public query.

Only explicit currency/pay periods are normalized. Public-service salary has no period assumed. SS currency enum 1 was verified as GEL; other currencies are conservatively unpriced. Jobs.ge client banners can belong to unrelated advertisers; those images are never used as employer logos. HR and SS logos come from vacancy-specific containers/data.

Read-only smoke check:

```sh
npm run source:probe -- --source=ss --save
```

The optional `--save` stores probes only under ignored `.local/probes/`.

Bounded existing snapshot refresh, with source advisory locks (changes source snapshots/review flags only):

```sh
npx tsx scripts/refresh-source-details.ts --limit=3 --source=hr
```

Omit `--source` to refresh a maximum of three existing records per supported source. Editors can inspect the fresh metadata and explicitly save it. This command does not publish anything.

Samushao.ge is retired at the owner’s request. Active configs, CLI, HTTP fetch and source selectors exclude it. Migration004 disables collection and archives vacancies exclusively associated with it. Historical parsing fixtures/audit data remain for compatibility; there is no active network path to that source.

SS pagination uses the public SSR totalCount and page size because visible links only show neighbouring pages. Each source run visits up to three additional listing pages, with the cursor retained in PostgreSQL. GitHub batches process up to 50 details per source; the backlog drains gradually and still shares capacity with existing-record rechecks.
