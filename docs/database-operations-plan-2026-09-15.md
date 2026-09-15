# ბაზის ეკონომიური მუშაობისა და მართვის გეგმა — 2026-09-15

## შედეგი და გადაწყვეტილებები

**ახლა ყველაზე მეტად საჭიროა worker-ის კავშირის ტიპის გადამოწმება, ზედმეტი ჩაწერის შემცირება და SQL-ის გაზომვადი მონიტორინგი.** ბაზა 214.03 MiB-ია; მხოლოდ მოცულობა პროვაიდერის ან გეგმის შეცვლას არ ასაბუთებს. ფასის ცვლილება არ დათვლილა: მოქმედი Neon გეგმა, compute-ის საათები, ისტორიის მოცულობა და გადასახადი SQL-დან არ ჩანს.

| პრიორიტეტი / სტატუსი | მოქმედება | მოსალოდნელი ეფექტი / ფაქტი | რისკი და მიღების პირობა |
| --- | --- | --- | --- |
| P0 — worker-ის lease და migrator-ის გაფრთხილება კოდში შესრულდა; 023 მიგრაცია/release production-ზე გასაშვებია; migrator-ისთვის direct endpoint კვლავ სასურველია | deployed worker-ისა და migration runner-ის URL შეამოწმეთ; სესიური advisory lock-ისთვის გამოიყენეთ direct endpoint | `.env`-ში pooled URL დადასტურდა; სესიური lock-ები კოდშია. თუ worker-იც ამ URL-ს იყენებს, წყაროს ურთიერთგამომრიცხავი გაშვება საიმედოდ დაცული არ არის | deployed secret არ წაგვიკითხავს; ცოცხალი კონფიგურაცია არ შეგვიცვლია. ჯერ runtime-ის host ტიპის შემოწმება, შემდეგ ერთი worker-ით lock-ის ტესტი იზოლირებულ ბაზაზე |
| P1 — კოდში შესრულდა | quality cleanup freshness UPDATE-ს შეუერთდა; უცვლელი raw აღარ გადაიწერება TOAST-ში | ჩვეულებრივი და quality-recovery recheck: `source_items` UPDATE **2 → 1**; cleanup-ის ცალკე SQL აღარ იგზავნება. 36 KB fixture-ის 19 TOAST chunk უცვლელად რჩება | დაბალი; freshness, expired branch, ხარისხის აღდგენა, შეცვლილი ტექსტი და audit DB ტესტით დაცულია |
| P1 — შესრულდა | `scripts/db-stats.ts` კითხვითი ინვენტარი | ზომები/TOAST/HOT/ინდექსები/კავშირები ერთ JSONL ანგარიშში; optional ღრმა ასაკობრივი სკანირება | თითო SQL-ზე READ ONLY, timeout 30s, lock timeout 2s; ხშირი გაშვება compute-ს გააღვიძებს. ავტომატური schedule არ დამატებულა |
| P1 — მიგრაცია შესრულებულია ფაილად და ლოკალურად | `021_statement_statistics.sql` + collector-ის top-15 total/calls/mean | PostgreSQL 18-ზე migration runner-ით დაყენდა; მეორედ გაშვება ცვლილების გარეშე; collector-ის 22 სექცია, მათ შორის სამივე top-15, მუშაობს | production DDL არ გაშვებულა — მომხმარებლის დასტური სჭირდება. პერიოდული export-ის schedule გარე გარემოში დასაყენებელია |
| P1 — დასამტკიცებელი | PITR history window-ის ფაქტობრივი მნიშვნელობის აღწერა და restore rehearsal | აღდგენის უნარის დადასტურება; სამიზნე RPO ≤24სთ dump-ით, RTO ≤60წთ მხოლოდ rehearsal-ის გავლის შემდეგ | ეს სამიზნეებია და არა უკვე მიღწეული SLA; branch/backup-ის ღირებულება და ოპერაცია მომხმარებელმა უნდა დაამტკიცოს |
| P2 — გეგმა | ავტომატური audit-ის 90-დღიანი hot retention + არქივი | მომავალი ზრდის შეზღუდვა; **დღეს >90 დღის კანდიდატი 0-ია** | audit ისტორიის დაკარგვა; export/restore-ის შემოწმებამდე არაფერი წაიშალოს; unresolved `source.changed` დაიცვას |
| P2 — გეგმა | counts cache-ის გაზომვა SQL/API ნაკადის ცვლილებების შემდეგ | განმეორებითი ფილტრების CPU/I/O-ის შემცირება | stale რაოდენობები, პერსონალური `exclude`, expiry და ფასიანი განთავსებები cache key/TTL-ში გასათვალისწინებელია |
| P2 — მხოლოდ საჭიროებისას | table-specific autovacuum ან fillfactor ექსპერიმენტი | ზედმეტი dead tuples/index churn-ის შემცირება | მიმდინარე მონაცემები emergency tuning-ს არ ამართლებს; ექსპერიმენტი ჯერ ასლზე, გაზომვით |
| P3 — არ შესრულდეს ახლა | unused ინდექსის წაშლა / VACUUM FULL / პროვაიდერის ცვლილება | დადასტურებული ეკონომია ამ აუდიტში არ არსებობს | uniqueness-ის დაკარგვა, დიდი lock, ინფრასტრუქტურული ცვლილება; ცალკე დასაბუთება და თანხმობა სჭირდება |

## 1. საზღვრები და გაზომვის მეთოდი

- production: Neon `neondb`, PostgreSQL **18.6**, `max_connections=225`; `.env`-ის hostname შეიცავს `-pooler`-ს. credential/hostname ანგარიშში არ არის გადმოტანილი.
- ძირითადი გაზომვა: **08:35:48–08:36:09 UTC / 12:35:48–12:36:09 თბილისი**; დამატებითი კითხვითი გადამოწმებები ამავე სესიაში. სტატისტიკა გროვდებოდა თითო SELECT-ის ცალკე `BEGIN READ ONLY` ტრანზაქციაში. მთელი ანგარიში ერთი ატომური snapshot არ არის; პარალელური worker-ის გამო რიცხვები მცირედ იცვლება.
- `pg_postmaster_start_time=08:30:49 UTC`, `pg_stat_database.stats_reset=NULL`. ამიტომ დაგროვილი counters-ის დაწყების დრო **უცნობია**; ისინი დღეებზე/uptime-ზე არ გაყოფილა. გაზომვისას SQL/API ნაკადი production-დან ასლს კითხულობდა; მისი `psql ClientWrite` დატვირთვა ქვემოთ გამოყოფილია.
- შესრულდა მხოლოდ SELECT/კატალოგები და ტრანზაქციის ლოკალური უსაფრთხოების პარამეტრები. production-ზე არ გაშვებულა worker, retention, migration, CREATE EXTENSION, VACUUM, ინდექსის ცვლილება ან სტატისტიკის reset.
- `ertad_perf.jobs` საწყისი შემოწმებებისას 0 იყო — ასლის ჩატვირთვა ჯერ მიმდინარეობდა; საბოლოო კითხვით უკვე 12,518 რიგია. quick win შემოწმდა `127.0.0.1:55432/ertad_test`-ზე, დროებით ცხრილებში, production-ის სქემასთან საერთო DML გზით. ასლზე API benchmark-ს SQL/API ნაკადი აკეთებს.
- საწყისი გაზომვისას production-ის migration ledger-ში იყო **001–016**, საერთო `ertad_test`-ში **001–019**; მოგვიანებით SQL ნაკადმა ლოკალურად 020 გაატარა. production-ში `jobs_verified_logo_company_idx` უკვე არსებობს, თუმცა 017 ledger-ში არ წერია. ეს schema drift-ის კონკრეტული მაგალითია: migration-ის სახელით სქემის მდგომარეობის გამოცნობა არ შეიძლება.

გამეორება, არსებული უსაფრთხო `DATABASE_URL`-ით:

```sh
node --import tsx scripts/db-stats.ts
node --import tsx scripts/db-stats.ts --deep
```

Default რეჟიმი კატალოგებსა და სტატისტიკას კითხულობს; `--deep` payload-ის ზომასა და ასაკებსაც სკანირებს. სკრიპტი არ ბეჭდავს SQL ტექსტებს, პაროლებს, IP-ებს ან რიგების შიგთავსს. `unavailable: true` ნიშნავს გამოტოვებულ სექციას და არ უდრის ნულოვან დატვირთვას. `elapsed_ms` შეიცავს ქსელისა და ტრანზაქციის დროებს; ეს SQL-ის სუფთა execution time არ არის. `settings.setting` შეიცავს collector-ის ლოკალურ timeout-საც; `reset_val` აჩვენებს საწყის მნიშვნელობას.

## 2. კავშირები და pool-ის ზომა

### რეალური ნიმუშები

| UTC | სხვა backend-ები, collector-ის გარეშე | აქტიური | idle in transaction | განმარტება |
| --- | ---: | ---: | ---: | --- |
| 08:35:49 | 1 | 1 | 0 | `psql`, `ClientWrite`, xact ასაკი 58წმ — ასლის გადმოტანა |
| 08:35:54 | 2 | 1 | 0 | იგივე copy + 1 idle `pgbouncer` |
| 08:36:09 | 2 | 1 | 0 | copy-ის xact ასაკი 78წმ + 1 idle `pgbouncer` |

Collector კიდევ ერთ კავშირს იყენებდა. ეს არის **მოკლე, დაბალი დატვირთვის ნიმუში**, არა production peak; `pg_stat_activity` ხედავს PostgreSQL backend-ებს და არა PgBouncer-ის ყველა frontend socket-ს. pool exhaustion არ დაფიქსირდა, მაგრამ მისი არარსებობა პიკისას არ დამტკიცებულა.

### რეკომენდაცია კომპონენტების მიხედვით

| კომპონენტი | ახლა | რეკომენდაცია / მიზეზი | რისკი |
| --- | --- | --- | --- |
| Web `lib/server/db.ts` | თითო instance-ზე max=5, connect=10s, idle=30s, singleton `globalThis`-ში | **დარჩეს 5**, pooled endpoint. მოთხოვნის შემდგომი logo/profile/employer კითხვები პარალელურია; 1-მდე დაწევა რიგს გააჩენს. 2–3 მხოლოდ კონკურენტული API p95/queue დროების შედარების შემდეგ | serverless instance-ების რაოდენობა უცნობია; 5 არ ნიშნავს სულ 5 კავშირს |
| Scheduler `worker/continuous.ts` | max=1, query/statement timeout=15s; polling 30s; მაქს. 3 child | **დარჩეს 1**; მას ერთი მცირე due-source კითხვა აქვს | pooled startup/session timeout-ის გარანტია runtime-ზე ცალკე შეამოწმეთ |
| თითო `worker/main.ts` child | იყენებს საერთო `db()`-ს, ანუ **max=5** | **დარჩეს 5**, direct endpoint. ერთი client წყაროს სესიურ lock-ს უჭირავს, კიდევ რამდენიმე transaction-ს ასრულებს | max=1-ზე lock-ის დამჭერი client დანარჩენ სამუშაოს pool-იდან კავშირს აღარ დაუტოვებს; ეს რიგის timeout-ს გამოიწვევს |
| Migration/restore/pg_dump | საერთო connection helper ან CLI | direct endpoint; ერთოპერაციული პროცესი | სესიური lock/SET-ის დარღვევა pooler-ზე |

ერთი scheduler-ის ზედა client ბიუჯეტი: **1 + 3×5 = 16**; web-თან ერთად `5×N_web_instances + 16×N_worker_replicas + CLI/cron`. დამატებითი GitHub cron პროცესები ცალკე ითვლება. ეს client cap-ია; pooled web sockets PostgreSQL backend-ებთან ერთი-ერთში არ გადაითვლება. 225 ლიმიტიდან ოპერაციებისა და პირდაპირი worker-ებისთვის დატოვეთ მარაგი; დაბალი გამოყენების ნიმუშით pool-ის შემცირება არ დასაბუთდა. კონფიგურაციის კოდი არ შეცვლილა. [node-postgres pool sizing](https://node-postgres.com/guides/pool-sizing).

### Neon transaction pooling-ის მნიშვნელოვანი შეზღუდვა — P0

Neon PgBouncer ტრანზაქციის ბოლოს backend-ს ათავისუფლებს. SQL-level `PREPARE/DEALLOCATE`, სესიური SET-ის მდგრადობა და სესიური advisory lock-ები ამ რეჟიმს არ შეესაბამება. Protocol-level named prepared statements თანამედროვე Neon PgBouncer-ში მხარდაჭერილია; ყველა prepared statement-ის აკრძალვა არასწორი იქნებოდა. პროექტი ჩვეულებრივ `query(text, values)`-ს იყენებს. [Neon connection pooling](https://neon.com/docs/connect/connection-pooling).

- `worker/run.ts` და `worker/refresh.ts`: `pg_try_advisory_lock` → network crawl → `pg_advisory_unlock`, რამდენიმე ტრანზაქციის მიღმა. `PoolClient`-ის დაკავება PgBouncer-ის backend-ს სესიის განმავლობაში არ მიამაგრებს. შედეგი შეიძლება იყოს ორი worker-ის ერთდროული დაშვება ან დაუბრუნებელი lock სხვა backend-ზე.
- `scripts/migrate.ts`: სესიური `pg_advisory_lock(917400)`; ამიტომ ისიც direct URL-ს საჭიროებს.
- `worker/importer.ts`-ის `pg_advisory_xact_lock` და `worker/purge.ts`-ის `pg_try_advisory_xact_lock` ერთ რეალურ ტრანზაქციაშია — transaction pooling-ს შეესაბამება. `transaction()` იმავე client-ზე აკეთებს BEGIN/COMMIT-ს.
- `.env` pooled-ია, მაგრამ `.github/workflows/scrape.yml` იყენებს ცალკე `SCRAPER_DATABASE_URL` secret-ს. deployed worker-ის host ამ აუდიტში **არ დადასტურებულა**. პირდაპირი მისამართი ავტომატურად არ აგვირჩევია და secret არ შეგვიცვლია.
- არ გადაიქცეს მთელი მრავალწუთიანი crawl ერთ DB ტრანზაქციად მხოლოდ lock-ის შესანარჩუნებლად: ეს connection-ს და ძველ snapshot-ს დიდხანს დაიკავებს. direct კავშირი არსებული lock მოდელის შესაბამისი გზაა.

## 3. ძვირი მოთხოვნები, ინდექსები და cache

### pg_stat_statements

`SELECT extname,extversion FROM pg_extension`: მხოლოდ `plpgsql 1.0`. `pg_stat_statements` preload-შია, extension კი ამ database-ში დაყენებული არ არის. **Top-15 რეალური total/calls/mean შედეგი unavailable-ია**, ნულები ან გამოგონილი რეიტინგი არ არის მოცემული.

DDL მომზადებულია `db/migrations/021_statement_statistics.sql`-ში და **მხოლოდ ლოკალურ იზოლირებულ PG18-ზე გაშვებულია**: `CREATE EXTENSION IF NOT EXISTS pg_stat_statements;`, lock timeout 3s / statement timeout 30s. production-ზე ჩართვის შემდეგ collect/export ყოველ 5–15 წუთში და ნორმალური სამუშაო დღის პიკისას. Neon compute-ის suspend/restart-ზე statement history იკარგება; export საჭიროა გრძელვადიანი შედარებისთვის. [Neon pg_stat_statements](https://neon.com/docs/extensions/pg_stat_statements).

```sql
-- კითხვითი, extension-ის ცალკე დამტკიცებული ჩართვის შემდეგ.
SELECT queryid, calls, round(total_exec_time::numeric,2) total_ms,
       round(mean_exec_time::numeric,2) mean_ms,
       shared_blks_read, temp_blks_written, wal_bytes, query
FROM pg_stat_statements
WHERE dbid=(SELECT oid FROM pg_database WHERE datname=current_database())
ORDER BY total_exec_time DESC LIMIT 15;
-- ცალკე გაიმეორეთ ORDER BY calls DESC და ORDER BY mean_exec_time DESC.
-- query ტექსტი დარჩეს წვდომაშეზღუდულ ოპერაციულ ანგარიშში.
```

`pg_stat_database`: **7,833 temp file / 88,624,758,204 bytes (82.54 GiB)**, 0 deadlock. ეს დაგროვილი temp I/O-ა, **არა დისკზე ახლანდელი ზომა** და არა დღიური ხარჯი. statement telemetry-ის გარეშე საძიებო მოთხოვნას ვერ მივაწერთ. SQL/API ნაკადისთვის გადასაცემი ჰიპოთეზაა sort/hash/CTE spill: ასლზე `EXPLAIN (ANALYZE, BUFFERS)` მხოლოდ SELECT-ებისთვის და `temp read/written` შედარება. production-ზე work_mem-ის ზრდა არ გაკეთებულა; იგი პარალელურ ოპერატორებსა და connections-ზე მრავლდება.

### ინდექსები

- public ცხრილებზე 27 ინდექსი, ჯამში **12.32 MiB** (TOAST-ის შიდა ინდექსები ცხრილის TOAST ზომაშია).
- `idx_scan=0`: **`schema_migrations_pkey` 16 KiB**, **`analytics_events_pkey` 16 KiB**. ორივე primary key-ია და uniqueness/იდენტობის გარანტია აქვს; არ წაიშალოს.
- სრული ერთნაირი განსაზღვრების დუბლიკატი **0**: შედარებულია ცხრილი, access method, keys/include, opclass, collation, order, uniqueness/null semantics, expression და predicate. ნაწილობრივი ფუნქციური გადაფარვა ამით არ გამოირიცხება.
- ყველაზე დიდი: `jobs_fingerprint_idx` 2.63 MiB / 28,799 scan; `audit_log_pkey` 1.48 MiB / 2,328; `jobs_automation_idx` 1.23 MiB / 5; `source_items_unparsed_idx` 0.98 MiB / 3,019.
- `source_items_job_idx`: 6,549,772 scan — job-სა და source-ს შეერთების აქტიური გზა. მისი წაშლის საფუძველი არ არსებობს.
- მცირე `idx_scan` არ ნიშნავს უსარგებლობას, მით უმეტეს reset-ის უცნობი ფანჯრისას. drop-ის წინ საჭიროა ≥7 დღე წარმომადგენლობითი workload, constraint/dependency შემოწმება და rollback DDL. საძიებო ინდექსები SQL/API ნაკადის პასუხისმგებლობაა; ამ ნაკადის 021 migration მხოლოდ სტატისტიკის extension-ს აყენებს, ინდექსებს არ ცვლის.

### counts/facets cache-ის არჩევანი — ჯერ გეგმა

| ვარიანტი / პრიორიტეტი | ეფექტი | რისკი / საჭირო გასაღები |
| --- | --- | --- |
| არსებული CDN cache — P1, SQL/API ნაკადთან | გაზიარებულ ერთი და იმავე მოთხოვნაზე DB-მდე მისვლა იკლებს; დღეს headers 60s + SWR 300s-ია | `exclude`, `ids`, preview კერძოა; ასეთი პასუხი საერთო cache-ში არ მოხვდეს. mutation-ის შემდეგ დროებითი stale დასაშვებობა დასამტკიცებელია |
| bounded in-process cache, TTL 15–30s + ერთი მიმდინარე Promise თითო key-ზე — P2 | ერთ instance-ში ერთნაირი counts-ის burst აერთიანებს | serverless instances cache-ს არ იზიარებს; capacity მაგალითად 100–200 key. key = ყველა ნორმალიზებული ფილტრი, ვერსია, visibility/დღე, საჭირო `exclude`; შეცდომა არ დაკეშდეს |
| დამოუკიდებელი წინასწარ დათვლილი unfiltered counts/facets, refresh 1–5წთ — P2 | პოპულარული საწყისი ეკრანის counts-ზე სრული scan აღარ არის | arbitrary search, filter intersection და relaxation counts მარგინალური totals-ით არ მიიღება. `analytics_daily`-სთან მსგავსი ცალკე ცხრილია საჭირო; live expiry/placement ინვალიდაცია და stale fallback შეთანხმდეს |

ეფექტი ჩაითვალოს cache hit ratio-თი, `calls`-ის შემცირებით და API p95-ით, SQL ნაკადის ოპტიმიზაციის **შემდეგ**. თანხობრივი ეკონომია ჯერ არ გაზომილა. in-process cache დაკარგვადი ოპტიმიზაციაა; სისწორის წყარო ბაზაა.

## 4. მოცულობა, ზრდა და vacuum

MiB = 1,048,576 bytes. Heap, index და TOAST სვეტებს მცირე FSM/VM overhead გამო საერთო ზომამდე ზუსტი ჯამი შეიძლება არ ჰქონდეს; TOAST შეიცავს თავის ინდექსს.

| ცხრილი | სულ MiB | heap MiB | ძირითადი ინდექსები MiB | TOAST MiB | live / dead (შეფასება) |
| --- | ---: | ---: | ---: | ---: | --- |
| audit_log | 89.34 | 54.73 | 1.89 | 32.69 | 65,166 / 0 |
| jobs | 69.13 | 15.12 | 5.30 | 48.67 | 12,518 / 330 |
| source_items | 46.98 | 16.35 | 5.15 | 25.45 | 15,868 / 1,316 |
| source_discovery_pages | 0.20 | 0.09 | 0.07 | 0.008 | 381 / 90 |
| source_runs | 0.109 | 0.047 | 0.031 | 0.008 | 272 / 21 |
| analytics_events | 0.086 | 0.023 | 0.031 | 0.008 | 253 / 0 |
| login_attempts | 0.039 | 0.008 | 0.031 | 0 | 0 / 39 |
| analytics_daily | 0.016 | 0 | 0.008 | 0.008 | 0 / 0 |

დანარჩენი მცირე ცხრილები და სისტემური overhead შედის database-ის 214.03 MiB-ში. ძირითადი სამი ცხრილი ჯამში 205.45 MiB-ია.

### JSON payload

| ველი | რიგები | `sum(pg_column_size)` MiB | JSON ტექსტად გადაქცეული MiB |
| --- | ---: | ---: | ---: |
| source_items.raw | 15,868 (NULL-ის ჩათვლით) | 25.80 | 75.67 |
| jobs.draft | 12,518 | 24.28 | 72.89 |
| jobs.published | 12,091 არა-NULL | 23.35 | 69.82 |

ეს მნიშვნელობების ზომებია და არა სრული ცხრილის ზომა, WAL ან ბილინგის byte-ები. 12,091 გამოქვეყნებულ რიგში `draft=published`; ლოგიკური დუბლირება არსებობს, მაგრამ draft-ის წაშლა რედაქტორის მოდელს შეცვლის. ახლა უსაფრთხო გზაა მცირე projections/ნაკლები გადაცემა (არსებული `reconciliationJobProjection` და transfer audit), ხოლო საცავის ნორმალიზაცია — P3, ცალკე დიზაინი/მიგრაცია/restore ტესტი.

### audit_log-ის ძირითადი მომხმარებლები

| action | რიგები | შენახული before/after payload MiB |
| --- | ---: | ---: |
| automation.published | 21,149 | 35.79 |
| source.imported | 12,434 | 20.45 |
| source.changed | 7,441 | 13.74 |
| source.hints_applied | 17,432 | 1.57 |
| source.enriched | 755 | 0.70 |
| automation.archived | 425 | 0.64 |
| publish | 436 | 0.56 |
| სხვა actions | 4,371 | 0.44 |

Payload სულ 73.89 MiB; პირველი სამი action მისი **94.7%**-ია. ზუსტი count ამ scan-ში 64,443 იყო; `n_live_tup=65,166` შეფასებაა. action-ს ცხრილის 89.34 MiB-ის ფიზიკური წილი ზუსტად ვერ მიეწერება shared pages/TOAST/index overhead-ის გამო.

ასაკი: **ყველა რიგი, გარდა ერთი `company.save` ჩანაწერისა, ბოლო 7 დღისაა**; ერთი 7–30 დღისაა; 30–90 და >90 დღის რიგები 0. ამიტომ 30/90-დღიანი retention დღეს ამ 89 MiB-ს ვერ გაათავისუფლებს.

თბილისის დღეების მიხედვით არსებული payload: 09-10 19.09 MiB; 09-11 13.93; 09-12 22.01; 09-13 10.18; 09-14 4.95; 09-15 არასრული დღე 1.41 MiB. ეს შემორჩენილი audit რიგების განაწილებაა და არა სრული storage/WAL-ის დღიური ზრდა. მასობრივი იმპორტები არ იძლევა მომავალი თვიური ზრდის სწორხაზოვან პროგნოზს.

`auditChange()` უკვე ინახავს განსხვავებულ ველებს და გრძელ ტექსტს 240 სიმბოლომდე ამოკლებს სიგრძის დამატებით. ბოლო 24სთ-ის რეალური `automation.published.after_data.published.description` მაქს. 248 სიმბოლოა; `source.changed`-ის საშუალო payload 253 byte. ეს უკვე არსებული ეკონომიაა, ამ ცვლილებას არ მიეწერება. ძველი audit-ის მასობრივი გადაწერა ახლა არ შესრულდეს: WAL/ისტორიის ზრდას და ორიგინალის დაკარგვას გამოიწვევს.

### HOT / dead tuples / autovacuum

| ცხრილი | n_tup_upd | n_tup_hot_upd | HOT % | last_autovacuum UTC |
| --- | ---: | ---: | ---: | --- |
| source_items | 446,301 | 288,519 | 64.65 | 09-15 04:55:47 |
| jobs | 243,667 | 159,048 | 65.27 | 09-15 05:05:47 |
| audit_log | 2,217 | 1,063 | 47.95 | 09-15 05:04:48 |
| source_runs | 266 | 260 | 97.74 | NULL |

HOT update ინდექსების ახალი ჩანაწერების საჭიროებას ზოგ პირობებში არ ქმნის; heap tuple/WAL მაინც იწერება. `source_items.next_check_at` ინდექსირებულია, ამიტომ freshness განახლების უბრალოდ WHERE-ით სრულად გამოტოვება არასწორი იქნებოდა. `jobs.automation_checked_at` recheck queue-ის watermark-ია; მისი მოცილება jobs-ს განმეორებით სამუშაოში დააბრუნებს.

`pgstattuple` არ არის დაყენებული; **bloat-ის ზუსტი % უცნობია**. `n_dead_tup` მხოლოდ შეფასებაა: jobs dead/live ≈2.64%, source_items ≈8.29%. ცხრილის ზომიდან payload-ის გამოკლება bloat-ის სწორი გაზომვა არ არის. ჩვეულებრივი vacuum სივრცეს ხელახლა გამოსაყენებლად ათავისუფლებს; `VACUUM FULL` ფაილის გადაწერას და ACCESS EXCLUSIVE lock-ს მოითხოვს. [PostgreSQL routine vacuuming](https://www.postgresql.org/docs/18/routine-vacuuming.html).

პარამეტრები: autovacuum=on; 3 worker; naptime=60s; vacuum threshold=50 + 0.2×reltuples; analyze=50 + 0.1×reltuples; insert threshold=1000 + factor 0.2; cost delay=2ms; cost limit=-1 (მემკვიდრეობით); freeze max age=200M. per-table `reloptions=NULL`; ყველაზე დიდი xid age <351k. `track_counts=on`, `track_io_timing=off`. საწყისი statement/lock timeout 0; idle-in-transaction timeout 300s.

მიმდინარე მიახლოებითი vacuum ზღვარი jobs-ზე 2,554, source_items-ზე 3,224 dead tuple-ია. 330/1,316 ჯერ ამ ზღვარზე დაბალია. tuning ახლა არ გაკეთდა. თუ ≥24სთ რამდენიმე sample-ში dead/live >20%, autovacuum ჩამორჩება ან queue latency იზრდება, ჯერ lock/long transaction შეამოწმეთ; შემდეგ ასლზე გაზომეთ:

```sql
-- მხოლოდ შემოთავაზება, production-ზე არ გაშვებულა.
ALTER TABLE source_items SET
  (autovacuum_vacuum_scale_factor=0.05, autovacuum_vacuum_threshold=100);
-- rollback:
ALTER TABLE source_items RESET
  (autovacuum_vacuum_scale_factor, autovacuum_vacuum_threshold);
```

ამ მაგალითით ზღვარი ≈893-მდე ჩამოვა; ხშირი vacuum-ის I/O-ც გაიზრდება. fillfactor-ის შემცირებას დაუყოვნებლივი rewrite არ მოჰყვება და table-ს შეიძლება მეტი სივრცე დასჭირდეს — P2 ექსპერიმენტია, არა გარანტირებული ეკონომია.

## 5. worker-ის ჩაწერა და დანერგილი quick win

| გზა | არსებული მოქმედება | გადაწყვეტილება / რისკი |
| --- | --- | --- |
| `stageVacancy` quality reset | ადრე ცალკე NULL/0 UPDATE | cleanup აუცილებელ freshness UPDATE-ში სრულდება, როგორც ჩვეულ, ისე expired branch-ზე; ცალკე query/tuple აღარ იქმნება |
| `stageVacancy` freshness/raw | last_checked/verified, next_check, failures/error კვლავ ახლდება | raw ინახება `CASE WHEN raw IS DISTINCT FROM incoming THEN incoming ELSE raw END`-ით; უცვლელი JSON-ის TOAST value გამოიყენება ხელახლა, შეცვლილი ტექსტი იწერება |
| `discoverItems` | 100 link-ის upsert batch; conflict-ზე last_seen/url/hints ახლდება | last_seen გამოიყენება 36-საათიან პრიორიტეტში. დროის coalescing ცვლის მნიშვნელობას; ჯერ არ გაკეთდეს. url/hints-ის განსხვავების შემოწმება მომავალი ცალკე ტესტით |
| `reconcileJob` | automation_checked_at ყოველ შესაბამის recheck-ზე | watermark აუცილებელია; ძირითადი snapshot UPDATE უკვე `IS DISTINCT FROM`-ითაა დაცული და audit მხოლოდ რეალურ ცვლილებაზე იწერება |
| `refreshDescriptions` | წარმატება stageVacancy-ში; შეცდომაზე failures/backoff/last_checked | failures და timestamps არ არის ზედმეტი ჩაწერა; მოკლება retry-ის სისწორეს შეცვლის |
| maintenance | `worker/main.ts` თითო პროცესში საათობრივ `lastPurge`-ს ინახავს | `continuous.ts` child-ს `--once`-ით თავიდან უშვებს; ყველა ახალ child-ს თავისი პირველი purge/rollup ექნება. xact lock მხოლოდ გადაფარულ purge-ს აჩერებს, მოგვიანებით თანმიმდევრულ scan-ს არა. მომავალში ერთი გამძლე maintenance schedule/watermark; ახლა არ შეცვლილა |

Batch-ები: discovery upsert 100; default detail batch 20 (ლიმიტი 1–1000), detail concurrency 3 (დასაშვები 1–6); GitHub workflow-ში batch 200/concurrency 3/budget 8წთ. `reconcileSource` მაქს. 500 job-ს იღებს და 4 ტრანზაქციად პარალელურ ჯგუფებში ამუშავებს. production-ში აქტიური წყაროების ინტერვალი 180წთ; detail interval ძირითადად 24სთ, `hrgov` 6სთ. scheduler-ის ერთდროული child cap 3 უცვლელია.

**გაზომვა `tests/worker-writes.test.ts`-ით:** იზოლირებული TEMP tables და row-level trigger ითვლის რეალურ UPDATE-ებს; დიდი, ნაკლებად შეკუმშვადი აღწერა TOAST storage-საც ამოწმებს. ძველ SQL-ზე თავდაპირველმა ტესტმა ნახა 2 UPDATE; საბოლოო ცვლილებით ჩვეულებრივი და ექვსივე residual quality მდგომარეობა 1 UPDATE-ით სრულდება. ცალკე შემოწმებულია unlinked expired branch-ის 7-დღიანი retry, ხარისხის გასუფთავება და unchanged TOAST; ნამდვილი ცვლილება კი raw/publication-ში ინახება და ორივე audit ჩანაწერს ტოვებს.

| საზომი | მანამდე | შემდეგ | ეფექტი |
| --- | ---: | ---: | --- |
| clean წარმატებული recheck: source_items UPDATE | 2 | 1 | −50% ამ გზის row updates-ში |
| ხარისხის დარჩენილი მდგომარეობის წარმატებული გასუფთავება | 2 | 1 | cleanup freshness-ის იმავე tuple-ში |
| ცალკე quality cleanup SQL | 1 | 0 | ერთი network round trip ნაკლები წარმატებულ შეფასებაზე |
| უცვლელი 36,023-byte probe: ახალი TOAST chunk-ები | 19 | 0 | იგივე chunk_id/შიგთავსი რჩება; ეს ლოკალური storage გაზომვაა |
| უცვლელი job-ის snapshot/version/updated_at | უცვლელი | უცვლელი | რედაქტორის ვერსია არ იცვლება |
| უცვლელი recheck-ის audit INSERT | 0 | 0 | ისტორია არ იკარგება |
| freshness timestamps / next_check | ახლდება | ახლდება | scheduling შენარჩუნებულია |

production-ის `15,863 / 15,868` clear რიგი მიუთითებს ფართო გამოსადეგობაზე, **არ ზომავს წარმატებული recheck-ების წილს ან WAL/ბილინგის შემცირებას**. ძველი და ახალი worker-ის თანაბარ workload-ზე `Δn_tup_upd`, WAL byte-ები და run duration უნდა შევადაროთ შემდგომ deployment-ზე. worker-ის rollback არის importer-ის ძველი UPDATE-ების დაბრუნება; მონაცემთა მიგრაცია არ სჭირდება. 021 telemetry migration worker-ისგან დამოუკიდებელია.

## 6. retention და არქივი — მხოლოდ დასამტკიცებელი გეგმა

**ქვემოთ არც ერთი DELETE/ALTER/maintenance ბრძანება production-ზე არ შესრულებულა.** ვადები ოპერაციული წინადადებებია; პირველ გაშვებას წინ უნდა უსწრებდეს export, checksum და restore rehearsal. ერთ batch-ზე მაქს. 500 რიგი, მოკლე transaction, lock_timeout 2s / statement_timeout 30s; განახლების პიკის გარეთ, batch-ს შორის შედეგის შემოწმებით. დიდი ერთჯერადი DELETE არ გამოიყენოთ.

| მონაცემი / პრიორიტეტი | შენახვის შეთავაზება | ახლა არსებული ასაკი / ეფექტი | რისკი |
| --- | --- | --- | --- |
| ავტომატური audit — P2 | DB-ში 90 დღე; encrypted არქივში 365 დღე; unresolved source.changed DB-ში დარჩეს | >90 დღის რიგი 0; დღეს ეკონომია 0, მომავალში ზრდას ზღუდავს | აღდგენა/export-ის დადასტურების გარეშე ისტორია იკარგება |
| admin/company/employer/ბილინგის audit — P2 | ავტომატური წაშლისგან გამორიცხვა; ცალკე შეთანხმებული პოლიტიკა | მცირეა; ეკონომიის მთავარი წყარო არ არის | რედაქტორისა და ოპერაციების ისტორიის დაკარგვა |
| source_runs — P2 | success 30 დღე; partial/failed/interrupted/deferred 90 დღე; running არ წაიშალოს | 272 რიგი, უძველესი 09-07, >30 დღე 0 | მოკლე retention debugging-ის ფანჯარას ამცირებს |
| login_attempts — P3 | არსებული login cleanup 15წთ; დამატებითი ყოველდღიური cleanup მხოლოდ >1 დღე | 0 live; 40 KiB allocated | მიმდინარე 15-წუთიანი rate-limit-ის ფანჯარას არ შეეხოს |
| analytics_events / daily — P2 | raw 30 დღე → atomic daily rollup; daily 400 დღე | 253 raw, უძველესი 09-12; daily 0 | raw-ის უბრალოდ წაშლა აგრეგატს დაკარგავს; არსებული rollup გამოიყენეთ |
| jobs — P2 | არსებული expired 1 დღე / removed 7 დღე, მხოლოდ automation-managed და unpaused | კანდიდატი ამ SELECT-ში 0; `worker/purge.ts` უკვე ასეთია | purge უკვე შლის მიბმულ audit-ს. expiry-ზე მეტი ისტორიის მოთხოვნა ამ პოლიტიკის ცალკე შეცვლას საჭიროებს |
| source_items/raw — P2 კვლევა | linked raw დარჩეს; unlinked + დადასტურებულად expired + 180 დღე უნახავი/შეუმოწმებელი — არქივის კანდიდატი | 3,350 unlinked; ზუსტი 180-დღიანი კანდიდატები ცალკე SELECT-ით | raw=NULL ნიშნავს unparsed queue-ს; პირდაპირ გასუფთავება ძველ URL-ებს ხელახლა დააქროლებს. საჭიროა tombstone/archived მდგომარეობა და worker ტესტები; ახლა არ დაინერგოს |

### ავტომატური audit-ის batch SQL

ზუსტად იგივე კანდიდატები ჯერ `SELECT count(*)`-ით და export-ით შეამოწმეთ. allowlist შეგნებულად არ შეიცავს admin/company/employer/submission/placement/billing actions-ს. მიუბმელი `job_id=NULL` allowed ავტომატური რიგი ასაკის წესით დამუშავდება; მიმდინარე source-change ინდიკატორისთვის საჭირო რიგი დაცულია.

```sql
-- გეგმაშია; export/restore-ის შემოწმებისა და თანხმობის შემდეგ.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='30s';
WITH candidates AS (
  SELECT a.id FROM audit_log a
  WHERE a.created_at < now()-interval '90 days'
    AND a.action IN ('automation.published','automation.pending','automation.archived',
      'automation.resumed','source.imported','source.linked','source.changed',
      'source.hints_applied','source.enriched','source.category_reclassified',
      'source.city_enriched','source.logo_enriched','source.quality_held')
    AND NOT (a.action='source.changed' AND EXISTS (
      SELECT 1 FROM jobs j WHERE j.id=a.job_id AND j.needs_review
        AND (j.published_at IS NULL OR a.created_at>j.published_at)
    ))
  ORDER BY a.id LIMIT 500 FOR UPDATE OF a SKIP LOCKED
)
DELETE FROM audit_log a USING candidates c WHERE a.id=c.id;
COMMIT;
```

### მცირე ცხრილები

```sql
-- გეგმაშია. ცალ-ცალკე მოკლე ტრანზაქციებად და backup-ის შემდეგ.
WITH candidates AS (
  SELECT id FROM source_runs WHERE finished_at IS NOT NULL AND (
    (status='success' AND finished_at<now()-interval '30 days') OR
    (status IN ('partial','failed','interrupted','deferred')
       AND finished_at<now()-interval '90 days'))
  ORDER BY started_at,id LIMIT 500 FOR UPDATE SKIP LOCKED
)
DELETE FROM source_runs r USING candidates c WHERE r.id=c.id;

WITH candidates AS (
  SELECT id FROM login_attempts WHERE created_at<now()-interval '1 day'
  ORDER BY created_at,id LIMIT 500 FOR UPDATE SKIP LOCKED
)
DELETE FROM login_attempts a USING candidates c WHERE a.id=c.id;

-- raw მოვლენები ჯერ არსებული rollupAnalytics() ფუნქციით უნდა შეჯამდეს.
WITH candidates AS (
  SELECT day,kind,value FROM analytics_daily
  WHERE day < (now() AT TIME ZONE 'Asia/Tbilisi')::date-400
  ORDER BY day,kind,value LIMIT 500 FOR UPDATE SKIP LOCKED
)
DELETE FROM analytics_daily a USING candidates c
WHERE (a.day,a.kind,a.value)=(c.day,c.kind,c.value);
```

`rollupAnalytics()` უკვე ერთ atomic `DELETE ... RETURNING → INSERT ... ON CONFLICT` statement-ში გადააქვს >30-დღიანი raw-ები daily-ში. ეს მოქმედება ამ აუდიტში არ გაშვებულა. მომავალში event volume-ის გაზრდისას თვით rollup-იც batch-ებად გასაზომია.

`source_items`-ის მხოლოდ კითხვითი არქივის კანდიდატების შერჩევა:

```sql
SELECT count(*) candidate_rows, sum(pg_column_size(raw)) payload_bytes
FROM source_items
WHERE job_id IS NULL
  AND last_seen_at<now()-interval '180 days'
  AND last_checked_at<now()-interval '180 days'
  AND raw->>'deadline' ~ '^\d{4}-\d{2}-\d{2}$'
  AND raw->>'deadline' < to_char(now() AT TIME ZONE 'Asia/Tbilisi','YYYY-MM-DD')
  AND quality_candidate IS NULL AND quality_warning IS NULL
  AND (refresh_requested_at IS NULL OR refresh_completed_at>=refresh_requested_at);
```

აქ raw-ის NULL-ად ქცევის ან row-ის წაშლის SQL განზრახ არ არის: არსებული queue semantics-ისთვის უსაფრთხო retention ჯერ არ არსებობს. source/external_id/url-ის tombstone-ის დაკარგვამ იგივე განცხადების ხელახლა იმპორტი შეიძლება გამოიწვიოს. სრული ტექსტის სარეზერვო ასლი ცალკე არქივში შენახვას მოითხოვს; worker-ის ცვალებად სქემაზე თანხმობა ცალკე გადაწყვეტილებაა.

## 7. მონიტორინგი და ხარჯის კონტროლი

| პრიორიტეტი | სიხშირე / მეტრიკა | საწყისი მოქმედების ზღვარი | შეზღუდვა |
| --- | --- | --- | --- |
| P1 | საათობრივ lightweight snapshot, 7 დღე; პიკისას რამდენიმე ნიმუში | DB backend-ები >70% limit-ზე ≥5წთ, idle-in-transaction >60წმ, pool checkout p95 >200ms | PostgreSQL backend რაოდენობა PgBouncer frontend queue-ს ვერ ზომავს; web-ში wait/total/idle counters-ის დამატება მომავალი ცალკე ცვლილებაა |
| P1 | API latency/error + worker last_success/next_run | API p95 იზრდება >20% baseline-თან; წყაროს ბოლო წარმატება >2×interval და next_run overdue | timeout-ისა და network-deferred წყაროსგან სტრუქტურული შეცდომა განასხვავეთ |
| P1 | pg_stat_statements export, თუ ჩართულია | query-ის calls/total/temp/WAL-ის მკვეთრი დელტა | restart/reset განსხვავებული epoch-ებია; უცნობი დაწყების counters-ს დღიურად ნუ გადააქცევთ |
| P2 | ყოველდღიური sizes/HOT/dead; `--deep` კვირაში ერთხელ | ცხრილის ზრდა >20% კვირაში ან >50 MiB/დღე; dead/live >20% რამდენიმე sample-ში | მასობრივი იმპორტი შეიძლება მოსალოდნელი იყოს; ავტომატური destructive cleanup არ დაუკავშიროთ |
| P1 | ყოველდღიური backup check, ყოველთვიური restore rehearsal | ბოლო წარმატებული backup >24სთ; rehearsal ვერ გადის | backup ფაილის არსებობა აღდგენის მტკიცებულება არ არის |
| P2 | Neon console-ის actual compute/storage/history/transfer usage კვირაში ერთხელ | baseline-თან მატება ახსნის გარეშე | SQL ზომა ბილინგის ჯამი არ არის; statement/worker ეკონომია ჯერ შესაბამის usage-ს შეადარეთ |

მონიტორინგს external შეტყობინება/ელფოსტა არ დაემატა; შედეგები JSONL/არსებული ოპერაციული ეკრანით შეამოწმეთ. `--deep` ხშირ polling-ად არ გადაიქცეს: payload scan compute-ს და I/O-ს მოიხმარს. collector-ის საკუთარი queries workload-იდან გამოყავით.

## 8. Backup / restore

**P1 — გეგმაში:** ჩაიწეროს Neon project-ის რეალური history window, branch ტიპი და ბოლო წარმატებული rehearsal. სამიზნე history window 7 დღე, თუ არსებული გეგმა/ბიუჯეტი იძლევა; ამ აუდიტში გეგმა ან window არ შეცვლილა. მიმდინარე Neon დოკუმენტაციით instant restore root branch-ებს ეხება; child branch ავტომატურად დამოუკიდებელი PITR backup არ არის. Restore არჩეული დროის სქემითა და მონაცემებით ცვლის branch-ის ყველა database-ს და კავშირებს წყვეტს; წინასწარ Time Travel Assist/Schema Diff-ით გადამოწმება აუცილებელია. [Neon instant restore](https://neon.com/docs/postgres/backup-restore/branch-restore), [history window](https://neon.com/docs/postgres/backup-restore/history-window).

წინადადება: ყოველდღიური სრული logical dump, encrypted გარე საცავში 7 daily + 4 weekly + 12 monthly ასლი, lifecycle-ის ღირებულების დადასტურებით. დამოუკიდებელი backup იცავს იმავე project-ზე წვდომის დაკარგვისგანაც. თვეში ერთხელ იზოლირებულ PostgreSQL **18**-ზე restore; PG16-ზე არსებული DML ტესტები PG18 dump-ის სრული თავსებადობის მტკიცებულება არ არის.

```sh
# მხოლოდ production runbook: production dump/restore არ გაშვებულა.
# ქვემოთ აღწერილი rehearsal მხოლოდ ლოკალურ ასლზე შესრულდა.
# PGSERVICE წინასწარ გამართული direct endpoint / read-only backup role-ია;
# პაროლი shell history-ში/ანგარიშში არ ჩაიწეროს.
PGSERVICE=ertad_backup_readonly PGOPTIONS='-c default_transaction_read_only=on' \
  /opt/homebrew/opt/postgresql@18/bin/pg_dump \
  --format=custom --no-owner --no-acl --file="$BACKUP_FILE"
/opt/homebrew/opt/postgresql@18/bin/pg_restore --list "$BACKUP_FILE"
# მხოლოდ ცარიელი, იზოლირებული PG18 test destination:
PGSERVICE=ertad_restore_scratch \
  /opt/homebrew/opt/postgresql@18/bin/pg_restore \
  --exit-on-error --no-owner --no-acl --dbname=ertad_restore "$BACKUP_FILE"
```

Restore QA: სქემა/`schema_migrations`, თითო ცხრილის count, foreign keys, jobs/source_items membership, role/grants საჭიროებები, audit/invoice/editorial snapshot-ების არსებობა; შემდეგ local application smoke test. snapshot-ის `createdAt`, checksum, software version, RPO/RTO და შემოწმების შედეგი ჩაიწეროს. cron/worker შეჩერებული იყოს scratch ბაზაზე, რომ rehearsal-მა გარე crawl ან ავტომატური purge არ დაიწყოს.

- **`scripts/restore-vacancy-backup.ts` სრული backup restore არ არის.** JSON v1-დან აღადგენს შერჩეული ვალიდური, ჯერ აქტუალური jobs/source_items-ის იდენტობასა და discovery seeds-ს, მხოლოდ ცარიელ destination-ზე `--apply`-ით; jobs გადადის `pending`-ში, published=NULL, ხელახალი გადამოწმება აუცილებელია. გაუვალი/ვადაგასული ჩანაწერი გამოტოვდება. იგი არ აღადგენს მთლიან audit-ს, რედაქტორის სამუშაოს, invoice-სა და სხვა ცხრილებს.
- **`scripts/audit-database-transfer.ts` კითხვითი payload audit-ია**, არა backup completeness checker: 500 job, 200 queue item და employer-directory projections-ის JSON bytes-ს ადარებს. სასარგებლოა transfer-ის ეკონომიის რეგრესიისთვის; TLS/Neon billing bytes არ არის.
- production PG18-ისთვის გამოიყენეთ PG18 `pg_dump`; სესიური SET-ების გამო direct endpoint. არსებული psql certificate workaround მხოლოდ ოპერაციულ client-ზე იყო ცნობილი; ამ ცვლილებაში აპის TLS validation არ შემსუბუქებულა.

## 9. მიგრაციების წესი

**P1:** `scripts/migrate.ts` პირდაპირი კავშირით იღებს სესიურ lock 917400-ს; .sql ფაილებს ალფაბეტურად გადის; ყოველი ფაილი ერთ BEGIN/COMMIT-შია, წარმატებისას სახელდება ledger-ში. შეცდომისას მხოლოდ მიმდინარე ფაილი rollback-დება; ადრე დასრულებულები რჩება. ბოლოს source seed-ების `ON CONFLICT DO NOTHING` სრულდება. ავტომატური down migration და checksum verification არ არსებობს.

1. არსებული ფაილი აღარ შეიცვალოს, თუ უკვე გამოყენებულია; ახალი ნომერი, scoped DDL, წინაპირობისა და rollback SQL-ის აღწერა. ამ ნაკადის **021 მხოლოდ `pg_stat_statements` extension-ია**; SQL/API ნაკადის 020 ფაილი ხელუხლებელია.
2. ჯერ migration ledger და რეალური `pg_indexes`/სვეტები შეადარეთ: production-ში 017 index უკვე ჩანს ledger-ის გარეშე. `IF NOT EXISTS` თვითონ განსაზღვრების თანხვედრას არ ამოწმებს.
3. `CREATE INDEX CONCURRENTLY` ამ runner-ში **არ შეიძლება**, რადგან იგი explicit ტრანზაქციაში ასრულებს ფაილს. ასეთი ინდექსისთვის საჭიროა ცალკე დამტკიცებული nontransactional runbook/runner მხარდაჭერა, ერთი direct session, validity შემოწმება და ledger-ის მოწესრიგება. წარუმატებლობამ invalid index შეიძლება დატოვოს. [PostgreSQL CREATE INDEX](https://www.postgresql.org/docs/18/sql-createindex.html).
4. ჩვეულებრივი index/DDL-ის lock window ჯერ ასლზე გაზომეთ; დიდი backfill batch-ებად, lock/statement timeout-ით და თავსებადი app rollout-ით. add-first/dual-read ან compatible fallback საჭიროებისამებრ; ძველი schema ერთდროულად მოქმედ instance-ებს ერგებოდეს.
5. production გაშვება — მომხმარებლის გადაწყვეტილება, backup/restore-ის კონკრეტული მტკიცებულებისა და გაზომილი lock/latency-ის შემდეგ. destructive down-ის ნაცვლად ხშირად corrective forward migration სჯობს; rollback არ უნდა ნიშნავდეს ახალი მონაცემების დაკარგვას.

## 10. თითო რეკომენდაციის შესრულების სტატუსი

„შესრულებულია“ ქვემოთ ნიშნავს სამუშაო tree-ში დასრულებულ და ლოკალურად შემოწმებულ ცვლილებას ან შესრულებულ კითხვით აუდიტს; **production rollout არ გაკეთებულა**. ცვლილების არგაკეთება, როცა გაზომვა სარგებელს არ ამტკიცებს ან სისწორეს ცვლის, ცალკე მიზეზითაა დაფიქსირებული.

| რეკომენდაცია / პრიორიტეტი | სტატუსი | შედეგი ან არშესრულების კონკრეტული მიზეზი |
| --- | --- | --- |
| quality cleanup-ის ზედმეტი UPDATE / P1 | **შესრულებულია** | cleanup აუცილებელ freshness UPDATE-შია; ჩვეულებრივი, ექვსივე residual quality და expired გზა ტესტირებულია: 2→1 tuple update |
| უცვლელი raw-ის TOAST rewrite / P1 | **შესრულებულია** | PostgreSQL jsonb equality-ით ძველი value ინარჩუნებს chunk-ებს; რეალური ცვლილება ინახება და audit რჩება |
| რეალური ჩაწერის გაზომვა / P1 | **შესრულებულია** | TEMP table trigger ითვლის UPDATE-ებს; TOAST-ის chunk_id/შიგთავსი მოწმდება; regression გაიარა PG16-სა და PG18-ზე |
| კითხვითი DB collector / P1 | **შესრულებულია** | `scripts/db-stats.ts`; production კითხვითი ანგარიში, PG16/PG18 შესრულება, timeout-ები და extension-ის არყოფნის ასახვა |
| pg_stat_statements migration / P1 | **შესრულებულია ფაილად და ლოკალურად** | 021 მიესადაგება არსებულ runner-ს; PG18-ზე 001–021 და განმეორებითი migration წარმატებულია; top-15 სამივე ჭრილში დაბრუნდა |
| pg_stat_statements production ჩართვა / P1 | **არ შესრულდა** | **მომხმარებლის დასტური / production DDL**; 021 გასაშვები სექცია ქვემოთაა |
| web/worker/scheduler pool-ის შემცირება / P1 | **არ შესრულდა** | გაზომვაში saturation არ ჩანს; worker-ის lock+პარალელური სამუშაო 1-კავშირიან pool-ს ვერ იყენებს. 5/5/1 დარჩა; შემცირების ეფექტი დატვირთვის მონაცემებით ჯერ არ დასაბუთდა |
| deployed worker/migrator direct endpoint / P0 | **არ შესრულდა** | **გარე runtime/env და მომხმარებლის დასტური**; `.env` pooled-ია, deployed `SCRAPER_DATABASE_URL` ტიპი უცნობია. hostname-ის ავტომატურად შეცვლას გაურკვეველი ცოცხალი კონფიგურაცია ექნებოდა |
| PGAPPNAME-ით runtime კავშირების სახელდება / P2 | **არ შესრულდა** | **გარე runtime/env**; node-postgres უკვე იღებს `PGAPPNAME`-ს. web/worker-ს ცალ-ცალკე სახელი განთავსების გარემოში უნდა მიენიჭოს; ახალი კოდის API საჭირო არ არის |
| primary/unused/duplicate ინდექსების აუდიტი / P1 | **შესრულებულია** | მხოლოდ ორი 16 KiB primary key-ს აქვს idx_scan=0; ზუსტი დუბლიკატი 0 |
| ინდექსის წაშლა / P3 | **არ შესრულდა** | **დესტრუქციული production DDL**, თან უსაფრთხო კანდიდატი არ აღმოჩნდა; primary key-ის წაშლა ეკონომიის მიზნით არასწორია |
| დამატებითი საძიებო ინდექსები / P2 | **არ შესრულდა ამ ნაკადში** | **სხვა ნაკადის ფაილი/მიგრაცია**; SQL/API ნაკადი ფლობს search-plan/jobs/020-ს. უსაფუძვლო ინდექსი write cost-ს გაზრდიდა |
| არსებული CDN cache-ის ინვალიდაცია/TTL / P1 | **არ შესრულდა ამ ნაკადში** | **სხვა ნაკადის ფაილი** — `lib/server/jobs-cache.ts`, API route; არსებული privacy/exclude პოლიტიკა აღწერილია, შეცვლა SQL/API ნაკადს ეკუთვნის |
| in-process counts cache / P2 | **არ შესრულდა ამ ნაკადში** | **სხვა ნაკადის ფაილი + stale მონაცემის დასაშვები ვადის გადაწყვეტილება**; რამდენიმე instance-ის თანხმობა და private exclude key ტესტირებას მოითხოვს |
| წინასწარ დათვლილი counts/facets / P2 | **არ შესრულდა** | **სხვა ნაკადის query ფაილები + მომხმარებლის დასტური**; arbitrary filters/relaxations მარგინალური totals-ით არ გამოითვლება. ახალი freshness/ინვალიდაციის კონტრაქტი შეთანხმებული არ არის |
| აუდიტის compact diff / P1 | **უკვე არსებობდა; გადამოწმებულია** | `auditChange()` და ბოლო 24სთ payload-ები შეფასდა. არსებული ეკონომია ამ ახალ ცვლილებას არ მიეწერება |
| ძველი audit payload-ის მასობრივი გადაწერა / P2 | **არ შესრულდა** | **დესტრუქციული production ცვლილება**; საწყისი ისტორია დაიკარგება და rewrite WAL-ს გაზრდის |
| audit 90d + 365d archive / P2 | **არ შესრულდა** | **მომხმარებლის დასტური, production წაშლა, გარე არქივი/ხარჯი**; SQL ლოკალურად EXPLAIN-ით შემოწმდა; დღეს ასაკობრივი კანდიდატი 0 |
| source_runs 30d/90d retention / P2 | **არ შესრულდა** | **production წაშლა — მხოლოდ გეგმაში**; უძველესი ჯერ 09-07-ია, მიმდინარე ეკონომია 0 |
| login_attempts დამატებითი ყოველდღიური cleanup / P3 | **არ შესრულდა** | **production წაშლა — მხოლოდ გეგმაში**; არსებული 15წთ login cleanup მუშაობს, live row 0 და დამატებითი პროცესის სარგებელი უმნიშვნელოა |
| analytics raw→daily rollup / P2 | **უკვე არსებობდა; კოდი გადამოწმებულია** | ერთ atomic statement-ში სრულდება; ამ აუდიტში production rollup არ გაშვებულა |
| analytics_daily 400d retention / P2 | **არ შესრულდა** | **production წაშლა — მხოლოდ გეგმაში**; ახლა daily ცარიელია |
| jobs expired 1d/removed 7d purge / P2 | **არსებული ქცევა დატოვებულია** | ამ ნაკადს purge არ გაუშვია და ვადები არ შეუცვლია; მომხმარებლის მითითებით retention ცვლილება მხოლოდ გეგმაში რჩება |
| source_items/raw 180d archive/tombstone / P2 | **არ შესრულდა** | **მომხმარებლის დასტური / მონაცემთა შენახვის წესის ცვლილება**; raw=NULL ძველ რიგს unparsed queue-ში დააბრუნებს. ჯერ archived/tombstone semantics-ის შეთანხმებაა საჭირო |
| discovery last_seen-ის დროითი გაერთიანება / P2 | **არ შესრულდა** | **ქცევის შეცვლისთვის მომხმარებლის გადაწყვეტილება**; last_seen 36სთ-იან queue priority-ში გამოიყენება. timestamps-ის დაკარგვა no-op მოცილება არ არის |
| jobs automation_checked_at-ის გამოტოვება / P2 | **არ შესრულდა** | watermark-ის მოხსნა განმეორებით reconciliation-ს გამოიწვევს; უსაფრთხო ოპტიმიზაცია არ არის |
| jobs draft/published-ის საცავის ნორმალიზაცია / P3 | **არ შესრულდა** | **მომხმარებლის დასტური / რედაქტორის მოდელის ცვლილება**; live და draft ვერსიების განსხვავება შენარჩუნებული უნდა იყოს |
| maintenance-ის საერთო საათობრივი watermark / P2 | **არ შესრულდა** | **retention-ის გაშვების cadence-ის გადაწყვეტილება**; ვინ იღებს ownership-ს და ჩავარდნის შემდეგ როდის იმეორებს, შეთანხმებული არ არის. production purge-ს ამ ნაკადში schedule არ შეეცვალა |
| autovacuum per-table tuning / P2 | **არ შესრულდა** | ფაქტობრივი dead tuples მიმდინარე trigger ზღვარზე დაბალია; დამატებითი I/O-ის სარგებელი ჯერ არ დასაბუთდა. ცვლილება გაზომილ გაუარესებაზე დაიგეგმოს |
| fillfactor tuning / P2 | **არ შესრულდა** | HOT უკვე ~65%-ია; ადგილი შეიძლება გაიზარდოს და ინდექსირებულ next_check update-ს HOT ვერ გახდის. საკმარისი workload მტკიცებულება არ არსებობს |
| VACUUM FULL / P3 | **არ შესრულდა** | **აკრძალული destructive/დიდი lock-ის production ოპერაცია**; ზუსტი bloat-იც უცნობია |
| ლოკალური logical dump/restore rehearsal / P1 | **შესრულებულია** | `ertad_perf` → custom dump → იზოლირებული PG18 `ertad_restore`; 15 ცხრილის count+დეტერმინისტული row hash დაემთხვა |
| transfer audit-ის ხელახლა გაშვება / P1 | **შესრულებულია** | აღდგენილ ასლზე `scripts/audit-database-transfer.ts` წარმატებულია; მის ფაილში ცვლილება არ გაკეთებულა |
| Neon PITR/history window/branch rehearsal / P1 | **არ შესრულდა** | **გარე ანგარიში, branch ოპერაცია/ხარჯი და მომხმარებლის დასტური**; local restore ვერ ადასტურებს პროექტის რეალურ history window-ს |
| encrypted გარე backup და schedule / P1 | **არ შესრულდა** | **გარე ანგარიში/საცავი/ხარჯი**; მიმღები საცავი და წვდომის პოლიტიკა მოცემული არ არის |
| პერიოდული DB metrics export / P1 | **ინსტრუმენტი შესრულებულია; schedule არა** | **გარე runtime/scheduler**; collector გამოსაყენებლად მზადაა, background პროცესი ან ახალი host სერვისი არ დამატებულა |
| web pool checkout p95/API metrics endpoint / P1 | **არ შესრულდა ამ ნაკადში** | **სხვა ნაკადის route/monitoring ინტეგრაცია**; არასად გამოყენებული getter-ის დამატება დასრულებული მონიტორინგი არ იქნებოდა |
| მიგრაციის checksum/nontransactional runner / P1 | **არ შესრულდა** | **სხვა ფაილი** — `scripts/migrate.ts` დასარედაქტირებელ სიაში არ არის; შესაბამისი წესი და CONCURRENTLY შეზღუდვა აღწერილია |
| provider/plan/compute/PITR ხარჯის შეცვლა / P3 | **არ შესრულდა** | **მომხმარებლის დასტური და გარე ხარჯი**; SQL ზომიდან გადასახადის შემცირება არ დგინდება |

## 11. საბოლოო ფაილები და release შემოწმება

| კატეგორია | საბოლოო შედეგი |
| --- | --- |
| შეცვლილი ფაილი | `worker/importer.ts` — quality cleanup გაერთიანებულია freshness-თან; unchanged raw-ის TOAST reuse |
| შექმნილი ფაილები | `tests/worker-writes.test.ts`, `scripts/db-stats.ts`, `db/migrations/021_statement_statistics.sql`, ეს დოკუმენტი |
| DB მიგრაცია | **021**, მხოლოდ telemetry-სთვის; worker quick win-ისგან დამოუკიდებელია. production გაშვება მომხმარებლის დასტურით |
| env | importer-ს ახალი env არ სჭირდება. Neon-ზე `pg_stat_statements` უკვე preload-ში აღმოჩნდა; სხვა PostgreSQL-ზე telemetry-სთვის shared_preload_libraries + restart საჭიროა |
| production runtime | worker deployment ამ სესიაში არ გაკეთებულა; web build მარტო worker-ის კოდს არ გაუშვებს — ცვლილება worker-ის შემდგომ release-შიც უნდა მოხვდეს |
| დროებითი ფაილები | გაზომვის ლოგები, dump და იზოლირებული build/DB `/tmp`-შია; repo-ში ამ ნაკადის დროებითი script/log არ დამატებულა |
| commit/push/deploy | არ შესრულებულა |

შემოწმდა მიმდინარე source snapshot `/tmp/jobx-db-release-final.R3Dnqf`-ში, რათა სხვა ნაკადის shared `.next` preview არ დაზიანებულიყო. snapshot-ში ყველა source file არსებობდა; შემდგომ სხვა ნაკადის `app/refined-board.css`/ანგარიშის ცვლილება ამ build-ის ფარგლებს გარეთაა. ამ ნაკადის importer/test/collector/021 ფაილები შემოწმების შემდეგ byte-for-byte ემთხვევა სამუშაო tree-ს. საერთო საბოლოო release სხვა ნაკადების ბოლო ცვლილებებითაც უნდა შემოწმდეს.

- **`npm run build` — წარმატებულია**, Next 16.3.4 webpack: compiled 5.1s, TypeScript 3.1s, 9/9 static გვერდი, build traces. დარჩა dependency-ის არსებული `DEP0205 module.register()` გაფრთხილება.
- **`npm run typecheck` — წარმატებულია**, ცალკე build-ის შემდეგ.
- **`npm run lint` — წარმატებულია**.
- **`npm test` — 265/265 წარმატებულია, 0 ჩავარდნა, 0 გამოტოვებული, 106.95წმ**. isolated PostgreSQL 18.6 `127.0.0.1:55438/ertad_test`, schema 001–021; `RUN_DB_TESTS=1` და DATABASE_URL/TEST_DATABASE_URL/TRANSFER_TEST_DATABASE_URL სამივე ამ ბაზაზე იყო მიმართული. პარალელური ნაკადის საერთო test DB არ შეცვლილა.
- საბოლოო worker regression PG16-ის საერთო local `ertad_test`-ზეც გაიარა; ის მხოლოდ საკუთარი TEMP tables-ის ფარგლებში წერს. raw chunk-ების reuse, ექვსივე quality ველი, შეცვლილი ტექსტი/audit და expired branch შემოწმებულია.
- 021 შესრულდა რეალური `scripts/migrate.ts` runner-ით isolated PG18-ზე; განმეორებითმა runner-მა არაფერი შეცვალა. extension-ის DROP transaction-ში და ROLLBACK წარმატებით შემოწმდა — ხედები დაბრუნდა და statement rows ისევ იკითხებოდა.
- ქვემოთ მოცემული დამოუკიდებელი 021 runbook-იც იგივე ლოკალურ PG18-ზე შესრულდა: extension/ledger-ის განმეორებითი გაშვება idempotent იყო. შემოწმების ბოლოს მხოლოდ ამ ნაკადის isolated PG18 სერვერი გაჩერდა; საერთო local PostgreSQL სერვერი და production არ შეცვლილა.
- collector-ის **22 სექცია**, `unavailable=0`; top total/calls/mean სამივე **15-15 რიგი**. ამით extension-ის არსებობის კოდის გზაც რეალურად შემოწმდა. production-ის ძველი ანგარიში extension-ის არყოფნის გზას ასახავს.
- retention-ის ოთხი DML მაგალითი და archive SELECT ადრე local READ ONLY ტრანზაქციაში მხოლოდ EXPLAIN-ით შემოწმდა. ეს სინტაქსს ადასტურებს, არა წაშლის მომავალ ბიზნეს-შედეგს.

### ლოკალური backup rehearsal-ის შედეგი

მხოლოდ წაკითხვით აიღო **ლოკალური `ertad_perf`**; `pg_dump` 18.6 custom archive გამოვიდა **33,469,475 byte (31.92 MiB)**. ცალკე PG18-ზე `pg_restore --exit-on-error` წარმატებით დასრულდა. UTC-ში ნორმალიზებული თითო რიგის JSON hash-ების დალაგებული aggregate და count **15-ვე public ცხრილზე დაემთხვა**: jobs 12,518; source_items 15,868; audit_log 7,441; analytics_events 253; migration ledger 20.

**ეს არ არის სრული production backup-ის ან PITR-ის მტკიცებულება:** `ertad_perf` თავდაპირველად მხოლოდ შერჩეულ ცხრილებსა და `source.changed` audit-ს შეიცავდა; ამიტომ restored audit 7,441-ია და არა production-ის 64,443. ტესტი ადასტურებს local dump/restore-ს, PG16→PG18 logical restore-ის ამ სქემის თავსებადობას და არსებული snapshot-ის მთლიანობას; production RPO/RTO ჯერ დადასტურებული არ არის.

აღდგენილ ასლზე `scripts/audit-database-transfer.ts`: reconciliation 500 row — 7,004,775→3,306,224 JSON byte (−52.8%); recheck queue 200 row — 1,339,151→385,590 (−71.2%); employer directory — 2,089,004→1,540,466 (−26.3%). ეს უკვე არსებული projection-ების ეფექტია და ახალ TOAST ცვლილებას არ მიეწერება.

## 12. production-ზე გასაშვები — მხოლოდ მომხმარებლის დასტურის შემდეგ

1. **Worker კოდის release:** importer-ის გაერთიანებული UPDATE/TOAST reuse არ მოითხოვს backfill-ს, env-ს ან 021-ს. ამ სესიაში deployment არ შესრულებულა. deployed worker-ის direct endpoint P0 საკითხი release-ის შემკრებმა გადაამოწმოს.
2. **Telemetry 021:** production-ზე extension-ის დამატება არ გაშვებულა. `scripts/migrate.ts` ყველა pending ფაილს ატარებს — production ledger საწყისად 016-ზე იყო; `npm run db:migrate` ბრმად გაშვება 017–020 სხვა ნაკადების DDL-საც გაატარებს. საერთო runner მხოლოდ **ყველა** pending migration-ის approval-ის შემდეგ გაეშვას.
3. თუ approval მხოლოდ დამოუკიდებელ 021-ზეა, იგივე ledger/lock-ის წესით ცალკე direct-session ოპერაცია შეიძლება შესრულდეს ქვემოთ მოცემული runbook-ით. credential არ ჩაიწეროს history-ში; `PGSERVICE` წინასწარ გამართული direct administrative კავშირია. **ეს runbook production-ზე არ გაშვებულა.**

```sh
PGSERVICE=ertad_migrations_direct psql -X --set=ON_ERROR_STOP=1 --single-transaction <<'SQL'
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
SELECT pg_advisory_xact_lock(917400);
\i db/migrations/021_statement_statistics.sql
INSERT INTO schema_migrations(name) VALUES ('021_statement_statistics.sql')
ON CONFLICT DO NOTHING;
SQL
```

4. **კითხვითი შემოწმება:** `node --import tsx scripts/db-stats.ts`; extensions-ში pg_stat_statements და top-15 სექციები უნდა დაბრუნდეს. `unavailable` გამოიკვლიეთ; მიგრაციის ledger-ის არსებობა მოდულის preload-ს თავისთავად არ ადასტურებს. პერიოდული JSONL export ჯერ გარე scheduler-ში არ დაყენებულა.
5. **Rollback:** worker-ისთვის მხოლოდ importer-ის ძველი SQL დაბრუნდეს. telemetry-ს rollback-ის საჭიროებისას ჯერ metrics export შეინახეთ, მერე direct მოკლე transaction-ში `DROP EXTENSION pg_stat_statements` (**CASCADE-ის გარეშე**) და მხოლოდ `021_statement_statistics.sql` ledger row-ის წაშლა; application tables/worker SQL ამას არ ეყრდნობა. DROP არის ცალკე დასამტკიცებელი DDL და statement ისტორიის წვდომას დროებით წაშლის. სხვა migration ledger ჩანაწერები ხელუხლებელი დარჩეს.

retention DELETE, source_items archive, VACUUM FULL, provider/plan/history window ცვლილება და cloud restore ამ release-ის გასაშვებ სიაში **არ შედის** — ისინი შესაბამისი ცალკე გადაწყვეტილების მიღებამდე გეგმაშია. სხვა ნაკადების დროებითი `.q.ts`/`.subcategory-stats.ts` ამ ნაკადს არ წაუშლია; საერთო release-ის შემკრები მათ მფლობელებთან ამოწმებს.
