# სკრაპერების და რესურსების მდგომარეობა — 2026-09-21

მხოლოდ დაკვირვება (production DB: `BEGIN READ ONLY`, `statement_timeout=30s`). კოდი და ბაზა უცვლელია.

## A. სკრაპერები

### sources (ცოცხალი წყაროები)

| id | enabled | last_success_at (UTC) | next_run_at | consecutive_failures |
|---|---|---|---|---|
| gancxadebebi | true | 09-21 04:57 | 09-21 06:17 | 0 |
| hr | true | 09-21 04:56 | 09-21 06:17 | 0 |
| hrgov | true | 09-20 21:30 | 09-21 00:30 (გასული) | 0 |
| jobs | true | 09-21 04:56 | 09-21 06:17 | 0 |
| myjobs | true | 09-21 04:57 | 09-21 06:17 | 0 |
| ss | true | 09-21 04:57 | 09-21 06:17 | 0 |
| worknet | true | 09-20 21:30 | 09-21 00:30 (გასული) | 0 |
| jobx | **false** | არასდროს | — | 0 |
| samushao | false, **retired** | არასდროს | — | 0 |

`hrgov`/`worknet`-ის `next_run_at` წარსულშია (00:30, ახლა >08:00) — ეს ორივე `lib/admin-attention.ts`-ის მიხედვით ლოკალურ collection-ზეა (GitHub Actions მათთან ვერ აღწევს), ასე რომ ცხრილში ჩანს "ჩამორჩენილი", მაგრამ `last_success_at` მხოლოდ ~11 საათის წინაა — არა "გაჩერდა" (რომელიც 3×interval, ანუ 9სთ-ს სცილდება ცოტათი, თუმცა threshold-თან ახლოსაა).

### source_runs, ბოლო 48სთ

- ყველა წყარო ბოლო გაშვებაზე **success**-ია.
- **`ss` 4-ჯერ ზედიზედ ჩავარდა**: 09-19 15:53, 20:40, 23:05 და 09-20 04:53 (`gh run view` → job `scrape (ss)` failure ყველგან). შეცდომა: `"Stopped after 3 consecutive detail failures"` — 9 დეტალის გვერდი ჩავარდა, 3-ვე `budgetExhausted:false`-ით შეჩერდა.
- 09-20 10:02:42-ზე იყო **ხელით გაშვებული** `workflow_dispatch` (ემთხვევა 033 მიგრაციის apply-ის დროს, 10:02:00.58) — ამის შემდეგ `ss` ყველა გაშვება წარმატებულია (16:06, 20:49, 23:15, 09-21 04:56). ანუ პრობლემა 09-20 დილიდან თავისით/ხელით მოგვარებულა და აღარ განმეორებულა >24სთ.
- `jobs`-საც ჰქონდა ერთი `partial` (09-19 10:59, budget exhausted-ის გარეშე) — იზოლირებული შემთხვევა, არ განმეორებულა.

### source_items რიგი (job_id IS NULL AND raw IS NULL)

| source | queued_new | failures<3 | failures≥3 | discovered>3დღე |
|---|---|---|---|---|
| jobs | 2310 | 2310 | 0 | 2309 |
| hr | 410 | 410 | 0 | 409 |
| hrgov | 119 | 119 | 0 | 119 |
| gancxadebebi | 30 | 8 | 22 | 21 |
| ss | 43 | 43 | 0 | 43 |
| worknet | 9 | 9 | 0 | 9 |

**ეს რიცხვები არ ნიშნავს ჩამორჩენას.** 033 მიგრაციამ (`next_check_at='infinity'` მთელ ძველ backlog-ზე) გარდაქმნა ეს ჩანაწერები ჯგუფად, რომელსაც ახალი "new-only" ლოგიკა (`worker/new-only.ts`) აღარასოდეს გადაამოწმებს — ისინი **tombstone**-ებია, არა "ჩამოკიდებული სამუშაო". `next_check_at<=now()`-ით რეალურად "due" – ყველგან **0**. ბოლო 2 დღეში ახლად აღმოჩენილი ჩანაწერები (122/188/16/149/42/31/55 წყაროზე) ყველა უკვე `job_id`-ითა და `raw`-ით არის შევსებული (წარმატებით შემოტანილია) — ანუ **import pipeline რეალურად მუშაობს**, "queued_new"-ის დიდი რიცხვები მხოლოდ ისტორიული, განზრახ გაყინული ბექლოგია.

### jobs — publish/expire, დღიური ნაკადი

| source | published | expired (search_deadline<დღეს, published-ს შორის) | archived |
|---|---|---|---|
| gancxadebebi | 1898 | 0 | 6 |
| hr | 3162 | 0 | 118 |
| hrgov | 55 | 3 | 42 |
| jobs | 2405 | 1 | 2698 |
| myjobs | 565 | 0 | 92 |
| ss | 2165 | 0 | 113 |
| worknet | 532 | 0 | 39 |
| jobx | 1 | 0 | — |

expired (published-ს შორის ვადაგასული) თითქმის ნულია ყველგან — ვადაგასული ვაკანსიები რეალურად გადადიან `archived`-ში, რეკონსილიაცია მუშაობს.

დღიური შემოსვლა (Asia/Tbilisi, ბოლო 3 სრული დღე + დღევანდელი ნაწილობრივი):

| source | 09-18 | 09-19 | 09-20 | 09-21 (12:23-მდე) |
|---|---|---|---|---|
| gancxadebebi | 97 | 67 | 5 | (ჯერ 0 ცალკე გამოთვლილი, ჯამში 5 ეკუთვნის 09-20 blok-ს) |
| hr | 16 | 171 | 0 | — |
| jobs | 213 | 129 | 27 | — |
| myjobs | 17 | 25 | 0 | — |
| ss | 15 | 14 | 0 | — |
| worknet | 0 | 37 | 0 | — |
| **ჯამი** | 359 | 443 | 32 (ნახევარდღიანი) | — |

09-20-ის დღის ჯამი (32) ჯერ არასრულია — query-ის მომენტისთვის (08:25 UTC = 12:25 Tbilisi) მხოლოდ ~12 საათი იყო გასული 09-20 (Tbilisi) დღიდან, ასე რომ ეს არ არის ვარდნა, არამედ ნაწილობრივი დღე.

### schema_migrations

`021_statement_statistics`, `031_scraper_economy`, `032_scraper_limits`, **`033_new_only_scraping`** — ოთხივე production-ზეა (033: 2026-09-20T10:02:00.58Z). სულ 33 მიგრაცია, ბოლო ეს არის.

## B. worker სად მუშაობს

- `curl https://jobx.ge/api/health` → `{"status":"ok","revision":"27c8c4f...402065c4"}`
- `git log -1 --format=%H main` → `27c8c4f6401422b66c51baffc1f997e0d02065c4` — **ემთხვევა**, production main-ის თავზეა.
- `gh run list --workflow=scrape.yml --limit 15`: ბოლო 15 გაშვება — 11 success, 4 failure (ყველა `ss`, ზემოთ აღწერილი). Cron-ის გაშვებები 3სთ-ში ერთხელ ხდება (`schedule` trigger), ხანგრძლივობა ჩვეულებრივ 1-2 წუთი, ზოგჯერ (fail-ის დროს) 7-9 წუთი.
- `hrgov`/`worknet` GitHub Actions matrix-ში არ ჩანს (მემორიის მიხედვით `worker:gov`-ით ლოკალურადაა) — ბაზაში მათი გაშვებები (3 თითოზე 48სთ-ში, ~3სთ ინტერვალით) ემთხვევა ლოკალურ launchd-ის cron-ს, არა GitHub-ის schedule-ს (GitHub-ის schedule ცხადად ჩანს matrix-ში hr/jobs/ss/gancxadebebi/myjobs-ისთვის).

## C. რესურსები

**pg_stat_database**: `xact_commit=544123`, `tup_inserted≈471K`, `tup_updated≈846K`, `tup_deleted≈163K` (კუმულატიური, stats_reset=null — არასდროს გასუფთავებულა). `temp_files=44920`, `temp_bytes≈329GB` (კუმულატიური დისკზე spill — მიუთითებს, რომ ზოგიერთი query sort/hash-ს მეხსიერებაში ვერ ეტევა).

**ცხრილების ზომა**: `jobs` 147MB (n_live_tup 13899, n_tup_upd 314727 — ბრუნვის კოეფიციენტი ცოცხალ მწკრივებთან ~22x, მაღალი UPDATE დატვირთვა), `audit_log` 109MB (n_live_tup 66310), `source_items` 70MB (n_tup_upd 505003, n_live_tup 19881 — ~25x ბრუნვა).

**pg_stat_statements**: აქტიურია (v1.12, migration 021 დადასტურებულია production-ზე). ტოპ query total_exec_time-ით: 82 გამოძახება, mean 2.67წმ, ჯამში 218წმ; მეორე — 16 გამოძახება, mean 3.46წმ, `temp_blks_written=31863` (~250MB spill თითო გამოძახებაზე). ეს query-ების ტექსტი ამ script-ს (`db-stats.ts`) არ გამოაქვს (მხოლოდ `queryid`) — კონკრეტული SQL საჭიროებს `pg_stat_statements.query`-ს ცალკე მოთხოვნას.

**Cache რეჟიმი, API routes** (`app/api/**/route.ts`):

| route | რეჟიმი |
|---|---|
| ყველა `admin/*` | `force-dynamic` + `no-store` |
| `catalogue`, `popular-searches`, `suggest` | **`force-dynamic` + `revalidate=N`** ერთდროულად |
| `jobs`, `events`, `sources` | `force-dynamic` |
| `jobs/[id]/similar` | `no-store` (force-dynamic-ის გარეშე) |

`app/page.tsx`, `app/vacancies/[id]/page.tsx`, `app/companies/[slug]/page.tsx` — არცერთს არ აქვს ცხადი cache/revalidate დირექტივა (ნაგულისხმევზეა).

**Vercel**: `vercel whoami` → `webinfinity11-5453`, ავტორიზებულია. `vercel project ls` (team `infinity-solutions`) აჩვენებს ერთადერთ `vakansiebi` პროექტს, production URL `jobx.ge`, განახლდა 19 წუთის წინ (ემთხვევა ბოლო deploy-ს). `vercel inspect`/ფუნქციების ლოგები ცალკე **არ შემოწმებულა**.

## D. დასკვნა — შემოთავაზებული გასწორებები

1. **`ss` consecutive-failure ინციდენტი (09-19–09-20) დახურულია** — ცვლილება არ სჭირდება, მაგრამ ღირს log-ის შენახვა/მონიტორინგი, თუ განმეორდება (ss-ის საიტმა შეიძლება დროებით შეცვალა HTML ან დაბლოკა). **ეკონომია**, არა "გატეხილია".
2. **`force-dynamic` + `revalidate=N` ერთდროულად** (`catalogue`, `popular-searches`, `suggest`) — `force-dynamic` თავად თიშავს ნებისმიერ route-level cache-ს, ასე რომ `revalidate` მკვდარი კონფიგურაციაა და ეს routes ყოველ მოთხოვნაზე ბაზას სვამენ. **გასწორება**: `app/api/catalogue/route.ts`, `app/api/popular-searches/route.ts`, `app/api/suggest/route.ts` — `force-dynamic`-ის მოხსნა (ან `revalidate`-ის მოხსნა, თუ დინამიურობა განზრახია). დაბალი რისკის, კოდის ცვლილება, დასტურის გარეშეც შესაძლებელი, მაგრამ საჭიროებს ტესტს production-ის მსგავს გარემოში.
3. **`temp_bytes≈329GB` კუმულატიური spill და 2 query 2.6-3.5წმ mean exec time-ით** — ღირს კონკრეტული `queryid`→SQL შესაბამისობის ამოღება (`SELECT query FROM pg_stat_statements WHERE queryid=...`) და შემდეგ გადაწყვეტა (ინდექსი თუ query rewrite). ეს ცალკე დავალებაა შემდეგი ნაკადისთვის — ტექსტი ჯერ არ ამოღებულა.
4. **`hrgov`/`worknet` `next_run_at` წარსულშია** ბაზაში, რადგან ისინი ლოკალურ launchd-ზეა დამოკიდებული და scheduler ცხადად ელოდება მომდევნო ციკლს ლოკალურ მანქანაზე. ეს არ არის production-ის ხარვეზი — უბრალოდ საჭიროა confirm, რომ ლოკალური `npm run worker:gov` პროცესი ჯერ კიდევ გაშვებულია (ტერმინალის შემოწმება საჭირო, ბაზიდან ვერ ჩანს).
5. **`jobx` წყარო `enabled=false`-ია** — თუ ეს განზრახია (პირდაპირი submission-ების წყარო, არა სკრეიპერი), ცვლილება არ სჭირდება; თუ არა, საჭიროებს დადასტურებას მომხმარებლისგან სანამ ჩაირთვება.
6. **`stats_reset=null`** pg_stat_database-ზე — სტატისტიკა არასდროს გასუფთავებულა schema-ს დაწყებიდან (09-07), ასე რომ ყველა კუმულატიური რიცხვი (xact_commit, tup_*) მოიცავს მთელ ისტორიას, არა მხოლოდ ბოლო პერიოდს — შედარებები 09-15-ის ანგარიშთან ამ გამო პირდაპირი დელტა არაა, საჭიროა ორივე წერტილის აბსოლუტური მნიშვნელობებით გამოკლება.

არცერთი ზემოთხსენებულთაგანი production DDL ან მასობრივ UPDATE-ს არ საჭიროებს.

## E. ნელი query-ები

**#1 (total_exec_time-ით პირველი)**: `queryid=8571098849328772419`, 99 გამოძახება, mean 2.32წმ, სულ 229.5წმ, `shared_blks_read=37203`. კოდი — `lib/server/employers.ts:121` (`employerRowsSql`): `jobs`+`source_items`+`sources` JOIN, ორმაგი `GROUP BY`. `EXPLAIN (ANALYZE, BUFFERS)`: `Seq Scan on jobs` — `shared hit=81874` (~640MB) 8881 published მწკრივზე; არსებული `jobs_status_idx` planner-ს არ იყენებს (selectivity დაბალია), ხოლო ხარჯის ძირითადი ნაწილი JSONB (`published`) heap-წვდომაშია. ეს query 10 წუთში ერთხელ იქეშება per-instance (`employerPages()`, `employers.ts:212-225`) — 99 გამოძახება ერთ window-ში ნიშნავს ბევრ ცალკე instance/cold-start-ს.

**#2 (temp_blks_written-ით პირველი)**: `queryid=7897222521443128563`, 16 გამოძახება, mean 3.46წმ, `temp_blks_written=31863` (~250MB/გამოძახება). კოდი — `lib/server/search-plan.ts:488` (`searchable AS MATERIALIZED` CTE, საძიებო/ფილტრის მთავარი query builder). `work_mem=4MB` (`SHOW work_mem`) — sort/hash დისკზე spill-ავს ყოველ გამოძახებაზე.

**შემოთავაზებული 2 გასწორება:**
1. **კოდი, დაბალი რისკი** — `lib/server/employers.ts:217` (`Date.now() - pages.at > 600000`): TTL 10წთ→30წთ (`600000`→`1800000`). ეს cache უკვე ატანს staleness-ს (comment: "Rebuilt at most every ten minutes"); TTL-ის გაზრდა პირდაპირ ამცირებს #1-ის გამოძახებების რაოდენობას ~3-ჯერ, ანუ total cost-ს ~229წმ→~76წმ ამ window-ში. Root cause (JSONB heap scan) არ სწორდება, მხოლოდ სიხშირე.
2. **კოდი, დაბალი რისკი, საჭიროებს production-ის მსგავს ტესტს** — `lib/server/search-plan.ts:24` (`publicRead`, `SET LOCAL statement_timeout='12s'` გვერდით) — დაემატოს `SET LOCAL work_mem='32MB'` იმავე ტრანზაქციაში (session-scoped, COMMIT/ROLLBACK-ზე თვითონ იბრუნება, სქემას არ ცვლის). მოსალოდნელი ეფექტი: #2-ის disk spill (31863 temp block) მცირდება ან ქრება, სავარაუდოდ mean 3.46წმ→<1წმ.

ინდექსი არცერთ შემთხვევაში არ არის ცალსახად საჭირო — #1-ში bottleneck არის JSONB heap-წვდომა (არა missing index selectivity), #2-ში work_mem. თუ TTL/work_mem ცვლილების შემდეგაც #1 ჯერ კიდევ ძვირია, შემდეგი ნაბიჯი იქნება `employers.ts`-ის ქეშის DB-ში გატანა (მაგ. მასალიზებული view ან ცალკე ცხრილი) — production DDL, ცალკე დასტურს საჭიროებს.
