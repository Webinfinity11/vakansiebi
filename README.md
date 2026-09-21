# ერთად — ვაკანსიების აგრეგატორი

ქართული ვაკანსიების ერთიანი ძებნა, წყაროების პერიოდული პარსინგი და ავტომატური შემოწმება და გამოქვეყნება.

**ამ ეტაპზე სატესტო პროდუქტია. შეტყობინებების გაგზავნა საერთოდ არ არის დაკავშირებული — არც ელფოსტა, არც Telegram. ავტომატური გამოქვეყნება ჩართულია მხოლოდ იმ წყაროებზე, რომლებზეც ადმინმა ის ცალკე დაუშვა; დანარჩენი ჩანაწერი ხელით ქვეყნდება.**

## რა მუშაობს

- Next.js / React ინტერფეისი: ძებნა, ქალაქი, მიმართულება, დისტანციური სამუშაო, ხელფასი, წყარო და გვერდები.
- PostgreSQL ბაზა და ცალკე Node.js ფონური პროცესი.
- `hr.ge`: საჯარო HTML და გვერდში არსებული announcement მონაცემები; დამალულ ხელფასსა და დამალულ საკონტაქტო ველებს არ იღებს.
- `jobs.ss.ge`: საჯარო ვაკანსიები, დამსაქმებლის ლოგო და განაცხადის ბმული.
- `vacancy.hr.gov.ge`: საჯარო სამსახურის ვაკანსიები, პირობები და ბოლო ვადა.
- `jobs.ge`: საჯარო HTML განცხადებების სია და დეტალები.
- `worknet.moh.gov.ge`: დასაქმების სახელმწიფო სააგენტოს საჯარო JSON (2026-09-12-ზე ~9,700 აქტიური ვაკანსია). ქალაქი მისამართის ტექსტიდან იკითხება; დამსაქმებლის საიდენტიფიკაციო კოდი და საკონტაქტო პირი არ ინახება.
- `awork.ge`: ვაკანსიების sitemap და SSR დეტალები; საწყისად გამორთულია, ჩართვა ადმინიდან.
- `myjobs.ge`: საჯარო JSON და SSR დეტალები (~720 ვაკანსია): ქალაქი, ხელფასი, კატეგორია, გამოცდილება, ენები.
- `gancxadebebi.ge`: მხოლოდ `ვაკანსია` კატეგორია. ამ განცხადებებს დამსაქმებელი არ ჰყავთ — კონტაქტი ტექსტშია. საჯარო კატალოგში ისინი „კერძო განცხადებად" აღინიშნება, დუბლიკატებში არ წყვილდებიან, გამოქვეყნება ავტომატურია, დანარჩენი წყაროების მსგავსად. `ვეძებ სამსახურს`, სტუდენტური, დისტანციური და სტაჟირების კატეგორიები არ შემოდის.
- დამატებითი აღმოჩენა HR.ge-ს sitemap-ებიდან და SS / საჯარო სამსახურის სიის გვერდებიდან; გვერდები ნაწილდება გაშვებებს შორის.
- შემოტანილი ვაკანსიის რედაქცია, ხელით გამოქვეყნება, არქივი, უარყოფა და აღდგენა. ადმინში ჩანს, ჩანაწერი ავტომატურად იმართება თუ ხელით, და რატომ ვერ ქვეყნდება (ვადა, წყაროზე აღარ არსებობს, არასრული მონაცემები); „ავტომატურ მართვას დაბრუნება" წყაროს ბოლო შემოწმებულ ვერსიას აქვეყნებს. სია ფილტრდება სტატუსით, ავტომატიზაციის მდგომარეობით და წყაროთი.
- წყაროს ბოლო ტექსტი, ადმინის რედაქცია და საჯარო ვერსია ინახება განცალკევებით. პარსერი რედაქციას არ გადაწერს.
- შესაძლო დუბლიკატები კომპანიის, პოზიციისა და ქალაქის ნორმალიზებული დამთხვევით; ადმინის მიერ გაერთიანებისას ყველა პირველწყარო რჩება.
- წყაროს ჩართვა/გამორთვა, სიისა და დეტალის შემოწმების ინტერვალი, ხელით შემოწმების რიგი და შემოტანის ისტორია. თითო წყაროსთან ჩანს რიგის სიღრმე, შეცდომიანი ჩანაწერები ყველაზე ხშირი პასუხებით, ხარისხის შემოწმებაზე შეყოვნებული ჩანაწერები და ის, უკავშირდება თუ არა ღრუბლის ქსელი ამ წყაროს.
- პაროლით დაცული ადმინი, ხელმოწერილი HttpOnly სესია, same-origin შემოწმება და შესვლის მცდელობების ლიმიტი.
- `/api/jobs?preview=1` და `/?preview=1` აჩვენებს გამოუქვეყნებელ ჩანაწერებს მხოლოდ ავტორიზებულ ადმინს.
- ძებნის ველი ასრულებს პოზიციებსა და კომპანიებს (`/api/suggest`): 8 შეთავაზება რაოდენობებით, სიის იმავე ხილვადობის წესებით; მინიმუმ ორი სიმბოლო, კლავიატურით იმართება.
- „მეტის ჩვენება" სიაში კიდევ 20 ვაკანსიას ამატებს არსებულებზე; ვაკანსიიდან დაბრუნებისას ჩატვირთული დიაპაზონი, გადახვევა და ფოკუსი აღდგება (მაქსიმუმ 10 გვერდი).
- ბოლოს ნანახი 12 ვაკანსიის ზოლი შედეგების თავზე, როცა ფილტრი არჩეული არ არის.
- „ჩემთან ახლოს" ქალაქს მოწყობილობის კოორდინატებით ირჩევს (haversine, 13 ქალაქი); გეოლოკაცია მხოლოდ ღილაკზე დაჭერისას იკითხება და მანძილიც ჩანს.
- ტელეფონზე ბარათის გადასმა: მარჯვნივ — შენახვა, მარცხნივ — დამალვა (აღდგენა სიის თავშია).
- მუქი თემა — მხოლოდ არჩევით, მასთეს ღილაკით. მოწყობილობის პარამეტრი საიტს არ ცვლის; არჩევანი `ertad-theme` გასაღებით ამ ბრაუზერში ინახება.
- PWA: `/manifest.webmanifest` და ხატულები (192, 512, maskable 512, apple-touch 180) — „მთავარ ეკრანზე დამატება" მუშაობს.

## ლოკალურად გაშვება

განახლებულ ინტერფეისში ვაკანსია ინახება ამ ბრაუზერში; გაზიარება იყენებს `/vacancies/UUID` ბმულს და მხოლოდ საჯარო ვაკანსიას აჩვენებს (ძველი `/?job=UUID` იმავე გვერდზე გადამისამართდება). ტელეფონზე გაზიარება სისტემურ ფანჯარას ხსნის, სხვაგან ბმულს ბუფერში აკოპირებს. დეტალებში ჩანს ლოგო, განაკვეთი, დამატებითი პირობები და აღწერის ბმულები. კომპანიის საერთო პროფილი (ლოგო, ოფიციალური საიტი, აღწერა) ადმინიდან ხელით იმართება და ყველა შესაბამის ვაკანსიაზე მოქმედებს.

Samushao.ge ამოღებულია აქტიური წყაროებიდან. მხოლოდ მასთან დაკავშირებული ჩანაწერები არქივში ინახება. პარსერების შესაძლებლობები და შეზღუდვები: [worker/SOURCES.md](worker/SOURCES.md).

საჭიროა Node.js 22.13+ და PostgreSQL 16+.

```sh
npm ci
cp .env.example .env
npm run admin:setup
```

`.env`-ში მიუთითე შენს PostgreSQL ბაზასთან კავშირის `DATABASE_URL`. ამ სამუშაო კომპიუტერზე ბაზაა `ertad`, პორტი `55432`, მონაცემთა საქაღალდე `.local/postgres`. პაროლი შეიქმნება `.local/admin-access.txt`-ში. ეს ფაილი და `.env` Git-ში არ შედის.

```sh
npm run db:migrate
npm run local:start
```

ან გაუშვი ორ ტერმინალში:

```sh
npm run dev
npm run worker
```

- საიტი: http://localhost:3000
- ადმინი: http://localhost:3000/admin
- ადმინის წინასწარი ნახვა: http://localhost:3000/?preview=1

`local:start` არსებულ `.local/postgres` ბაზას საჭიროებისას გაუშვებს. ახალ კომპიუტერზე ბაზა თავად უნდა შექმნა ან გამოიყენო შენთვის ხელმისაწვდომი PostgreSQL. სერვერი მხოლოდ ლოკალურ მისამართზე მუშაობს. `APP_URL` უნდა ემთხვეოდეს ბრაუზერში გამოყენებულ origin-ს; ნაგულისხმევად გამოიყენე `localhost` და არა `127.0.0.1`.

## შემოტანის პროცესი

1. წყაროს robots.txt და სია მოწმდება.
2. ახალი ბმულები PostgreSQL რიგში ინახება. იგივე წყაროს იგივე ID მეორედ არ ქმნის ვაკანსიას.
3. დეტალები იტვირთება შეზღუდული სიჩქარით; წყაროებს შორის მოთხოვნები თანმიმდევრულია.
4. ახალი ვაკანსია იღებს `pending` სტატუსს. ცვლილება ააქტიურებს `needs_review`-ს, საჯარო ტექსტს არ ეხება.
5. ადმინი საჭიროებისამებრ ჩასვამს წყაროს ახალ ტექსტს, დაარედაქტირებს და გამოაქვეყნებს.

სიის საწყისი ინტერვალია 3 საათი; hr/jobs/ss-ის უკვე შემოტანილი დეტალები დღეში ერთხელ მოწმდება (სიიდან გამქრალი ჩანაწერები პირველ რიგში), ახალი ბმულები კი უახლესიდან ძველისკენ. თითო გაშვება შემოსაზღვრულია დროით (`SCRAPE_BUDGET_MINUTES`, ნაგულისხმევად 22) და რაოდენობით (`CRAWL_BATCH_SIZE`); დეტალებს სამი პარალელური მუშა ამუშავებს (`DETAIL_CONCURRENCY`), თუმცა ერთ ჰოსტზე მოთხოვნები არასდროს ერთდროულია: hr/jobs/ss-ზე წამში ერთი, დანარჩენზე ორ წამში ერთი, robots.txt-ის `Crawl-delay` კი უპირატესია (jobs.ge — 5 წამი). აღმოჩენილი ბმულების რაოდენობა **არ არის** შემოტანილი ვაკანსიების რაოდენობა.

Jobs.ge კატეგორიების სიებიდან იკითხება (`jid=1` — მხოლოდ ვაკანსიები, ტენდერები/ტრენინგები აღარ შემოდის), ამიტომ თითო ჩანაწერს წყაროს კატეგორია და ქალაქი სიიდანვე მოჰყვება. ss.ge-ს სფერო და hr.ge-ს ბენეფიტები/ენები/მართვის მოწმობა ფაქტებში ჩანს. კატალოგის კატეგორიები 15-ია; კლასიფიკაციაში წყაროს საკუთარი კატეგორია უპირატესია, დანარჩენი სათაურის წესებით იხსნება (`worker/categories.ts`).

404/410, დროებითი ქსელური შეცდომა ან შეცვლილი HTML ვაკანსიას არ შლის. პრობლემურ დეტალს ხელახლა შემოწმება მზარდი ინტერვალით ენიშნება. წყაროს ერთდროული გაშვება PostgreSQL advisory lock-ით იზღუდება. გასული ბოლო ვადის მქონე გამოქვეყნებული ჩანაწერები საჯარო ძებნაში აღარ ჩანს.

```sh
npm run source:probe
CRAWL_BATCH_SIZE=6 npm run worker -- --once
npm run worker -- --source=hr
```

`source:probe` თითო წყაროდან მხოლოდ ერთ დეტალს ამოწმებს და არაფერს ინახავს ბაზაში. `--save` მხოლოდ ადგილობრივ, Git-იდან გამორიცხულ სატესტო HTML-ს ინახავს. HTTP პარსერები სამივე წყაროსთვის 2026-09-07-ზე შემოწმდა. ამ გარემოში curl-ით Jobs.ge ზოგჯერ 410-ს აბრუნებდა, ხოლო აპლიკაციის HTTP მოთხოვნა წარმატებული იყო. Playwright ამ ეტაპზე საჭირო არ გახდა და არ არის დამატებული.

## შემოწმება

```sh
npm run typecheck
npm test
npm run build
```

ინტეგრაციული ტესტი მხოლოდ ცალკე, სახელად `ertad_test` ბაზაზე მუშაობს:

```sh
createdb ertad_test
DATABASE_URL=postgresql://USER@localhost:5432/ertad_test npm run db:migrate
DATABASE_URL=postgresql://USER@localhost:5432/ertad_test RUN_DB_TESTS=1 npm test
```

ტესტები ამოწმებს პარსერებს, URL-ების შეზღუდვას, პაროლსა და სესიას, შემოტანილი/გამოქვეყნებული ტექსტების განცალკევებას, ერთდროული ცვლილებების კონფლიქტს, დუბლიკატების გაერთიანებასა და ვადაგასული ჩანაწერების გამორიცხვას. ინტერფეისის მხრიდან: ძებნაში დაბრუნების მდგომარეობა (გვერდი, ჩატვირთული დიაპაზონი, პოზიცია), ბრაუზერის საცავი დაზიანებული ჩანაწერებით, უახლოესი ქალაქის გამოთვლა, ავტოდასრულების პრეფიქსი, წერილის ტექსტი შენახული მონაცემებით და მუქი თემის ფაილის აქტუალობა. ინტეგრაციული ტესტი ნაგულისხმევად გამოტოვებულია, რათა სამუშაო ბაზა არ შეცვალოს.

## მიმდინარე ონლაინ გარემო

საიტი: https://jobx.ge — Vercel-ის `infinity-solutions/vakansiebi` პროექტი, ანგარიში `webinfinity11-5453`.
ადმინი: https://jobx.ge/admin.
ძველი სატესტო მისამართი `vakansiebi-gules.vercel.app` ცალკე `kapana22s-projects/vakansiebi` პროექტს ეკუთვნის; იქ განთავსება `jobx.ge`-ს არ აახლებს.

PostgreSQL განთავსებულია Neon-ის პროექტში `plain-sky-34116949`, `production` ბრენჩზე. არსებული ლოკალური მონაცემები გადატანილია; ამ სამუშაო კომპიუტერის საიტი და პარსერი იმავე ბაზას იყენებს. ამიტომ ლოკალურ ადმინში გამოქვეყნებაც ონლაინ საიტზე აისახება. დამოუკიდებელი ექსპერიმენტებისთვის გამოიყენე ცალკე სატესტო ბაზა.

Vercel-ის Production გარემოში საჭიროა `DATABASE_URL` (Neon-ის pooled მისამართი), `APP_URL`, `ADMIN_PASSWORD_HASH` და `SESSION_SECRET`. მიგრაციებისა და მუდმივი პარსერისთვის გამოიყენე Neon-ის direct მისამართი. საიდუმლო მნიშვნელობები Git-ში არ ინახება; `.vercelignore` ადგილობრივ ბაზას, პაროლებსა და სარეზერვო ასლებს ატვირთვიდან გამორიცხავს.

The cloud scraper runs in GitHub Actions (`.github/workflows/scrape.yml`) every 3 hours, at minute 17 UTC. Each source respects its admin interval, enabled status and manual request. GitHub schedules can be delayed. The two government sources (hrgov and worknet) use `scripts/local-gov-sources.sh` on this Mac, also every 3 hours; the Mac must remain awake.

`SCRAPER_DATABASE_URL` is a GitHub Actions secret containing the Neon direct connection URL; session advisory locks require the direct endpoint. Five cloud sources (hr, jobs, ss, gancxadebebi, myjobs) run with at most two jobs at once, a 200-detail limit, an 8-minute scraping budget and three discovery pages per source. New listings get priority and unfinished work stays queued. The local government limits are 100 details, 5 minutes and three pages per source. Source rate limits and robots.txt spacing still apply. Successful cloud runs align their next due time to the cron slot, so finishing several minutes after the start does not skip the next scheduled batch.

The admin panel opens on the source overview: completed results from the last 24 hours, source status, the next check and a shared 3/6/12/24-hour interval selector. Individual settings are collapsed. Status refreshes once a minute only while the tab is visible; full vacancy text is loaded only in the vacancy editor tab. The database usage link opens the existing Neon project.

The source overview also shows seven calendar days of new vacancies (Asia/Tbilisi), per-source work over 24 hours, and measured new-detail attempts, rechecks, unchanged results and linked duplicates. A new vacancy is a newly created job, not merely a discovered URL; its original posting date may be older. Historical attempt counters remain unknown, not zero. Work minutes sum source-run elapsed time and are not Vercel build CPU or a billing estimate. New repair runs count only actual content changes as changed.

The admin scraper limits control new-item batch size, run duration and additional listing pages. Completed vacancies are not rechecked. The saver preset uses 100 new records, 4 minutes and one additional page. Lower limits can miss recent announcements on busy sources; source rate limits remain in force.

New-only collection replaces the earlier economical/full recheck modes. Migration
`033_new_only_scraping.sql` retires the pre-switch backlog while retaining source IDs.
Each new ID is downloaded once; only source publication dates within today and the
previous two Tbilisi calendar days can create jobs. Completed IDs are not fetched again,
including after expired jobs are purged. Retries for failed first imports are bounded.
Stored deadlines control expiry without network rechecks. Scheduled description repairs
and seven-day unverified archival are disabled. See `docs/new-only-scraping.md` for rollout
and coverage limitations.

The two government hosts are not in the matrix: `vacancy.hr.gov.ge` and `worknet.moh.gov.ge` both time out from every GitHub-hosted runner. They are collected from this Mac by `npm run worker:gov` (a terminal tab; one pass every 3 hours over hrgov and worknet, advisory locks keep it from overlapping the workflow). `scripts/install-local-gov-sources.sh` registers the same pass as a launchd agent, but macOS privacy protection blocks a launchd agent from reading a project under `~/Desktop`: either grant Full Disk Access to `/bin/zsh` or move the project, otherwise use the terminal tab. The install script checks this and says which applies. Overlapping workflows queue, and database locks also protect against a local worker. Three consecutive detail failures stop that source's batch, retaining the remaining queue. A job fails only when the source itself needs attention: the run threw, the listing shape or reported coverage changed, three consecutive detail failures aborted the batch, or at least three pages and half the batch failed. Individual transient page failures and quality holds are posted as Actions warnings, keep the job green and still advance the source's last successful check, because the backoff retries them on its own. Every result remains visible in the admin history and the step summary. Sources with auto_publish enabled validate, publish, update and archive automatically. Invalid records wait for source recovery without a manual-review flag. The scraper never sends messages.

GitHub schedules may be delayed. In public repositories, schedules disable after 60 days without repository activity and must be re-enabled. Standard GitHub-hosted runners are free for this public repository; Neon usage is separate.

Production deployment runs through `.github/workflows/deploy.yml` at **09:00, 15:00 and 21:00 Asia/Tbilisi** (UTC+4). GitHub can delay schedules. Pushing to `main` no longer starts a Vercel build. The workflow compares main against the healthy live revision; identical code and documentation/test-only changes are skipped. Builds still run on Vercel with its existing cache. Vacancy database updates remain independent, and website deployment does not need this computer.

For urgent code changes: `gh workflow run deploy.yml --ref main`. Do not additionally run `vercel --prod`. The `VERCEL_DEPLOY_HOOK` GitHub secret grants only deployment of this project's main branch; keep its URL secret. Concurrent runs are serialized. Each run requests at most one build and waits up to 10 minutes for the new healthy revision at `https://jobx.ge/api/health`. A failed build is retried at the next run because production still serves the old revision. Failures appear in Actions. If production is already unhealthy, diagnose it first; use Vercel's manual deployment for an emergency code fix.

Environment-only changes do not change the Git SHA: use Vercel Redeploy once, with the existing build cache, after changing environment variables. `APP_URL` must be `https://jobx.ge`. Verify the CLI project is `infinity-solutions/vakansiebi` before deployment. `git.deploymentEnabled: false` disables Git-triggered builds while retaining the deploy hook. To restore automatic deployments, remove that setting and disable this scheduled workflow so the two mechanisms do not overlap.

## Google Analytics და Search Console

`jobx.ge`-ის GA4 ანგარიშია **JOBX** (`408126196`), property — **JOBX — jobx.ge** (`554293924`), ვებნაკადი — **JOBX Website** (`15781177095`), Measurement ID — `G-9S8J0W7QXM`. დროის სარტყელია საქართველო (UTC+4), ვალუტა — GEL.

Search Console-ის ერთადერთი sitemap: `https://jobx.ge/sitemap.xml`; `robots.txt` ამ მისამართს უთითებს. ერთი `<urlset>` შეიცავს ძირითად გვერდებს, ინდექსირებად ძიებებს მინიმუმ 10 ვაკანსიით, საჯარო აქტიური ვაკანსიების კანონიკურ მისამართებს და კომპანიებს, ამ თანმიმდევრობით.

XML წინასწარ გენერირდება (prerender) და საათში ერთხელ ახლდება (`revalidate: 3600`); მონაცემების განახლებისთვის ახალი build საჭირო არ არის. CDN პასუხს 1 საათით ინახავს, ხოლო განახლებისას ძველ ასლს კიდევ 1 დღის განმავლობაში გასცემს (`stale-while-revalidate: 86400`). პასუხი ერთ ნაჭრად იქმნება. 50,000 URL-ის ან 4 MiB-ის ლიმიტის გადაჭარბებისას სია ბოლოდან იკვეთება გაფრთხილების ჩაწერით. ბაზის შეცდომაზე ბრუნდება ძირითადი გვერდებისა და წარმატებით მიღებული სექციების ნაწილობრივი სია HTTP 200-ით და `Cache-Control: no-store`-ით, რათა მომდევნო მოთხოვნამ სრული სიის შექმნა ხელახლა სცადოს. ძველი `/sitemap-index.xml`, `/sitemap-pages.xml`, `/sitemap-searches.xml`, `/vacancies/sitemap.xml` და `/companies/sitemap.xml` მისამართები 301-ით გადამისამართდება `/sitemap.xml`-ზე.


`app/google-analytics.tsx` ტვირთავს Google tag-ს მხოლოდ production `https://jobx.ge`-ის საჯარო გვერდებზე. `page_view` იგზავნება ერთხელ თითო გვერდზე, Next.js-ის ნავიგაციის დროსაც. URL-ის query/hash და referrer-ის კერძო გზები იშლება. ადმინი, ინვოისები და preview გამორიცხულია; ფორმების ველები, აპლიკანტის კონტაქტები და შიდა ძიების ტექსტი არ იგზავნება. სარეკლამო პერსონალიზაცია და Google signals გამორთულია.

ვებნაკადის **Enhanced measurement გამორთული უნდა დარჩეს**: გვერდების ნახვებს კოდი მართავს. მისი ჩართვა browser-history page views-ს გააორმაგებს და შეიძლება შეაგროვოს გაუფილტრავი URL-ები ან ფორმების მეტამონაცემები. სტანდარტული სესიები, ვიზიტორები და ჩართულობა GA4-ს რჩება. ადგილობრივი `/api/events` სტატისტიკა დამოუკიდებლად მუშაობს.

## Railway-ისთვის მომზადებული სტრუქტურა

Railway-ზე სერვისი ჯერ არ არის გაშვებული. ქვემოთ მოცემული კონფიგურაცია მომავალში ცალკე პარსერის ან სრული გარემოს განსათავსებლადაა მომზადებული.

განთავსებისთვის საჭიროა ერთი PostgreSQL და ორი აპლიკაციის სერვისი:

- ვებგვერდი: `npm run build`, შემდეგ `npm start`; განთავსების წინ `npm run db:migrate`.
- ფონური პროცესი: `npm run worker`, იგივე `DATABASE_URL`, ვებდომენის გარეშე.

Railway-ის secrets-ში მიუთითე `DATABASE_URL`, `APP_URL`, `ADMIN_PASSWORD_HASH`, `SESSION_SECRET`. არ გამოიყენო სამუშაო კომპიუტერის პაროლი საჯარო სერვერისთვის. ბაზის backup/recovery უნდა მოეწყოს საჯარო გაშვებამდე. ლოკალური ბაზა `trust` რეჟიმშია მხოლოდ ამ კომპიუტერზე ტესტირებისთვის.

## მიმდინარე საზღვრები

- ერთი ადმინისტრატორის ანგარიში; მომხმარებლის რეგისტრაცია და CV-ების ატვირთვა ჯერ არ შედის.
- ავტომატური კატეგორიზაცია წყაროს კატეგორიას (jobs.ge, ss.ge, myjobs.ge) ან სათაურის წესებს ეყრდნობა და ადმინის შემოწმებას საჭიროებს.
- დუბლიკატების დამთხვევა კანდიდატებს აჩვენებს; სხვადასხვა ენით დაწერილი კომპანიების/პოზიციების სემანტიკური შედარება ჯერ არ კეთდება.
- ხელფასით დალაგება პირველ რიგში მხოლოდ მკაფიოდ მითითებულ თვიურ GEL თანხებს ადარებს. საათობრივ/წლიურ თანხებსა და უცხოურ ვალუტებს არ ურევს.
- ავტომატურად მართვადი ჩანაწერები ქვეყნდება, ახლდება და არქივდება. ხელით შესწორება კონკრეტული ჩანაწერის ავტომატიზაციას აჩერებს.
- robots.txt-ის გათვალისწინება არ უდრის კონტენტის ხელახალი გავრცელების უფლებას. ფართო საჯარო გაშვებამდე თითოეული წყაროს პირობები ცალკე უნდა შეთანხმდეს.
- GitHub-ში არ იტვირთება `.env`, ადმინისტრატორის პაროლი, `.local`, ბაზები, ჩამოტვირთული HTML ან build/cache ფაილები.
- `/api/suggest` ერთდროულად ორ მოთხოვნას უშვებს ბაზაში და თითო კლიენტს ათ წამში თორმეტს; დანარჩენს 429-ით უარყოფს. ეს აუზის ხუთ კავშირს იცავს — გაზომვით, დაცვის გარეშე 40 ერთდროულმა მოთხოვნამ 19 შეცდომა გამოიწვია და საიტიც ვერ იტვირთებოდა. ლიმიტი ინსტანციის მეხსიერებაშია, ანუ რამდენიმე ინსტანციაზე ჭერი ინსტანციების რაოდენობაზე მრავლდება; საერთო კვოტას საერთო მდგომარეობა დასჭირდებოდა.
- შეტყობინებები განზრახ არ არის და არც იგეგმება: საიტი არავის არაფერს უგზავნის — არც ელფოსტას, არც Telegram-ს. შენახული ძიების რაოდენობა მხოლოდ მაშინ მოწმდება, როცა „ჩემი სივრცე" იხსნება. ეს გადაწყვეტილებაა და არა დაუსრულებელი სამუშაო; გამოწერის, თანხმობისა და გამოწერიდან გასვლის მექანიზმი შესაბამისად არ არსებობს.
- CV-ის ატვირთვა და საიტიდან გაგზავნა განზრახ არ არის. `mailto` ფაილს ვერ ამაგრებს, განაცხადი კი ბოლომდე მომხმარებლის საფოსტო პროგრამაში იგზავნება — სწორედ იქ ამაგრებს ის CV-ს. სერვერი წერილს არასდროს აგზავნის.
- ტელეფონზე ბარათი აჩვენებს ორ ფაქტს (ქალაქი და განაკვეთი); სამუშაო რეჟიმი და „ახალი" ნიშანი ვაკანსიის გვერდზეა, რომ ბარათი ერთ ეკრანს არ გასცდეს.

GitHub verification (2026-09-09): HR, Jobs and SS imported 43 new pending vacancies in total. The government source timed out connecting from GitHub (`UND_ERR_CONNECT_TIMEOUT`) on two attempts, while responding locally. Its existing data is retained; scheduled retries follow the source backoff. This is an unresolved network reachability limitation, not a successful government-source cloud import. Removed HTTP 404/410 detail pages are rechecked after seven days and linked pending/published jobs are flagged for manual review.

## ტელეფონის განლაგება და თემა

ტელეფონის ყველა წესი ერთ ფენაშია — `app/phone.css`, რომელიც `globals.css`-ისა და `board.css`-ის შემდეგ იტვირთება; ადრე იგივე სელექტორები სამ ფაილში, ცხრა media-ბლოკში იმეორებდა ერთმანეთს. ზღვრები: ტექსტი არსად არ არის 12px-ზე პატარა, შეხების სამიზნე — 44px-ზე დაბალი, ხოლო ფორმის ველები 16px-ზე რჩება, რომ iOS Safari-მ ფოკუსისას გვერდი არ გაადიდოს. ჰორიზონტალური გადაქაჩვა არსად არის: განაკვეთის ჩანართები ტელეფონზე მოხსნილია (იგივე ფილტრი ფურცელშია), სწრაფი არჩევანი 2×2 ბადეა, მიმართულებები კი აბებად სიის ქვემოთ დგას. ფილტრები ქვედა ფურცლად იხსნება და ღილაკზე შედეგების რაოდენობას აჩვენებს; შედეგების ხელსაწყოების რიგი სიის თავზე რჩება.

მუქი თემა ხელით არ დაწერილა. საჯარო სტილებში 765 ფერის ლიტერალია და ტოკენების ფენა არ არსებობს, ამიტომ `scripts/build-dark-theme.ts` კითხულობს ღია სტილებს, ფერის შემცველ დეკლარაციებს ატარებს ერთ გარდაქმნაში (ტექსტი 62–94 სიკაშკაშეში, ფონი 10–30-ში, გაჯერებული აქცენტი ტონს ინარჩუნებს) და ხელახლა წერს `:root[data-theme='dark']`-ის ქვეშ, `app/theme-dark.css`-ში. ფერის შეცვლის შემდეგ სკრიპტი ხელახლა უნდა გაეშვას — `tests/theme.test.ts` ფაილს თავიდან აგენერირებს და ჩავარდება, თუ ჩაკომიტებული ვერსია ჩამორჩა. დამსაქმებლის ლოგოს ფონი და ლურჯი მასთედი ორივე თემაში ერთნაირია.

გაზომვები 390×664-ზე: ჰორიზონტალური გადავსება ნულია 390, 360 და 320px სიგანეზე, პირველი ვაკანსია 655px-ზე იწყება, ორივე თემაში მთავარი და ვაკანსიის გვერდის ტექსტი WCAG AA-ს აკმაყოფილებს. ყველა გაზომვა Chrome-ის მოწყობილობის ემულაციაშია; ნამდვილ ტელეფონზე შემოწმებული არ არის. სრული ჩანაწერი: [docs/qa-phone-ui-2026-09-12.md](docs/qa-phone-ui-2026-09-12.md).

## Vacancy discovery and trust logic

Search matches all normalized query terms across title, employer, city and description, regardless of word order. Relevance ordering gives title matches more weight than employer matches; recency breaks ties. Users can also explicitly sort by latest, comparable monthly GEL salary, or earliest deadline (unknown deadlines last).

Public provenance shows each source's last check and distinguishes recent successful checks (48 hours), older checks and failed checks. A successful fetch is not a guarantee that an employer is still accepting applications. Changes detected after publication are flagged while the approved public text is retained.

New imports from different sources can share a pending draft only when exactly one candidate has matching content, employer, city, dates, compensation, mode, employment type, facts and application links. Identical concurrent imports are serialized by a transaction lock. An automatically published candidate can also be linked; manually controlled, ambiguous, different-cycle and same-source postings are not automatically merged. Existing manual moderation and merge controls remain available.

## Personal workspace (no registration)

The results toolbar saves the current filters; the header's personal workspace opens saved searches and manual application history. Job details offer planned/applied/interview/closed stages. Stage changes do not submit a CV or contact an employer. Application snapshots remain in the personal list when public listings disappear. Searches restore all filters and return to the first results page.

Opening the saved-searches tab counts each saved search against the live catalogue: how many vacancies match now, and how many of those arrived since the search was saved. The window is the widest of 1, 3, 7 or 30 days that is not wider than the elapsed time, so the number is never inflated, and a button opens the search filtered to those. Nothing is sent and no subscription exists; the counts are computed when the panel is opened and not before.

A third tab keeps a name, a phone number and an email address under `ertad-personal:v1:applicant`. They are dropped into the letter a mailto opens — signing it where the placeholder was and appending only the ways to reach the person back — and nowhere else. With nothing stored the letter is byte for byte what it was.

Records live only in this browser and origin, with limits of 20 searches and 200 applications. Clearing site data removes them; another device/domain has a separate collection. Individual versioned storage keys, validation, cross-tab refresh, visible save failures and delete undo protect everyday use. Existing bookmarks remain separate and unchanged. No public account, login, notification subscription or personal-data API is added. Research and tradeoffs: [docs/personal-space-research.md](docs/personal-space-research.md).

## Application contact shortcuts

Vacancy details extract and display email addresses from the approved description, with a draft-email link and copy action. Recruitment context is distinguished from generic contact addresses. Mailto links inside source descriptions retain their recipient when converted to plain text; hidden cc/bcc/subject parameters from the source are not imported. The generated draft uses the position title and an editable Georgian body, with the applicant details saved in the personal workspace filled in when there are any. It opens the visitor's email client, which is where the visitor attaches the CV and sends it. CV applications do not use the invoice mail provider and there is no direct site CV upload/send flow.

## Invoice email

All invoices use a sequential six-digit payment code (for example `000123`), consistently on the invoice page, email and admin screen. Existing invoices use this same format. The sequence does not reset each year and is never truncated or wrapped; values above 999999 are rejected to avoid duplicate payment references. The private invoice URL still uses its random 64-character token.

Premium submissions require a separate, private `billingEmail`. The invoice and an immutable email payload are saved in the same database transaction (`026_invoice_email_delivery.sql`). The address is excluded from the public vacancy. Resend sends the invoice details and private invoice link to that address, with a BCC to `invoice@jobx.ge`; replies go to the same domain address. The email and invoice page include support number **579 53 53 20**. The domain inbox is intended to forward through ImprovMX to the owner's Gmail.

Configure production only after the sending domain and receiving address are verified:

- `APP_URL=https://jobx.ge`
- `RESEND_API_KEY`: sending-only key for `jobx.ge`, stored as a server secret.
- `INVOICE_EMAIL_ENABLED=true`: without this flag and the key, invoices are queued but no mail is sent.
- `CRON_SECRET`: a random secret of at least 32 characters for the authenticated retry endpoint.

Apply the migration before deploying the new invoice writer. Redeploy after changing Vercel variables. Correct billing payee/bank/IBAN settings are still required to offer Premium; email configuration does not enable Premium by itself.

The submission route starts delivery with Next.js `after()`. An atomic two-minute lease prevents concurrent sends. Retries reuse the unchanged payload and `jobx-invoice/<invoice UUID>` idempotency key. The Vercel cron (`/api/cron/invoice-email`, every ten minutes, up to five queued messages) recovers deferred work; this frequency uses the project's existing Pro plan. If moving to Hobby, use an external scheduler or adjust the schedule to that plan's limit. Immediate submission retries can also recover due messages. Failed calls back off and stop after six attempts; permanent provider rejection stops immediately. `sent` means Resend accepted the message, not that it reached the inbox: inspect Resend delivery events for bounces.

Operations: inspect `invoice_email_delivery` status, attempts, next attempt, provider ID and error code without exposing its private `payload`. Resend retains idempotency keys for 24 hours. An ambiguous send older than 23 hours stops with `idempotency_window_expired`; inspect Resend logs before manually resolving it, because clearing that protection could send a duplicate. A known rejection on the first attempt clears the ambiguity clock. Cancelled/refunded invoices are not sent. Existing invoices are not retroactively emailed because they have no verified billing recipient.

References: [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys), [Vercel cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing), [ImprovMX free forwarding](https://improvmx.com/pricing/).

English-dominant descriptions offer an explicitly labelled external Google Translate website link. Original text remains available; this is not an in-site or human-verified Georgian translation. No private CV data is sent to translation services.

## Automatic lifecycle

See [automation rules](docs/automation.md). Migration 007 adds opt-in source publication and per-job automation state. Existing editorial overrides are preserved.

### Stored salary enrichment

`npx tsx scripts/enrich-existing.ts` previews additive pay extraction across currently searchable jobs in batches of 100. Use `--apply` to write validated changes and audit entries. By default only automatically managed, unpaused jobs are eligible. An explicit `--include-editorial` also fills missing pay and adds source-text pay excerpts to editorial/paused records; it preserves existing salary text, publication state and automation flags. This option is for an intentional catalogue repair, not a scheduled override of editorial choices. Source advisory locks prevent overlap with crawlers. No source verification timestamp is advanced because this operation only reinterprets stored text.

Source comparison and recovery scope: [2026-09-10 audit](docs/source-audit-2026-09-10.md).

### Full source text and old records

Vacancy details retain the complete source description and add important conditions above it. Supported linked employer vacancy pages are also imported in full; source text is not replaced by a generated summary. Extra source facts are visible without expanding a disclosure. A temporary external failure retains the last verified text and stays in the refresh queue. An employer link that is readable but is not this vacancy (a different title, a removed page, a missing or duplicated posting) never blocks the vacancy itself: the record keeps its own source description and no employer text is appended. A snapshot that already holds verified employer text keeps that text and is retried instead of being shortened, but only for a bounded number of attempts, so a permanently broken employer link cannot freeze the record's other source fields. Every skipped employer link is logged with its reason.

After `npm run db:migrate`, use `npx tsx scripts/queue-description-refresh.ts --apply` to explicitly request a fresh fetch of all currently published primary sources, including older paused records. The existing GitHub scraper drains that queue first. Progress is stored in `source_items.refresh_requested_at` / `refresh_completed_at` and `source_runs`; newer editorial edits take precedence over queued requests. See [source adapters](worker/SOURCES.md).


## Admin scraper control

In **ადმინი → წყაროები და განახლება**, manage discovery, publication and source intervals; request a run for one/all enabled sources; retry pending description repairs; inspect GitHub and per-source history. The GitHub schedule requests a run every 3 hours; GitHub may delay scheduled runs. Turning off automatic discovery leaves previously requested description repairs enabled; disabling the source stops both on subsequent batches.

Due discovery runs first; description repair follows with at most 20 items / a separate 3-minute budget. Failed repairs remain queued and emit warnings; they cannot starve discovery. Hard infrastructure errors still fail the worker. Discovery quality warnings remain visible in Actions and the admin history.

For immediate admin-to-GitHub dispatch, set server-only `GITHUB_ACTIONS_TOKEN` in Vercel Production: a fine-grained token restricted to `Webinfinity11/vakansiebi`, **Actions: read and write**, with an explicit expiry/rotation plan. No client environment variable. The endpoint is fixed to `scrape.yml` on `main`, requires an admin session and same-origin POST, and coalesces dispatches for 60 seconds using a database lock. If the token is missing or GitHub rejects a request, the durable queue remains and the UI explicitly says it is awaiting a scheduled run. Never copy a token into this README, a screenshot or a chat message.

ვაკანსიის გვერდზე კატეგორიის ხელფასებთან შედარება მოხსნილია: ფართო კატეგორია თანაბარ პოზიციებს არ ნიშნავს. ვაკანსიის საკუთარი ანაზღაურება რჩება. ერთი მოკლე ამონარიდი (მაგალითად, მისამართი) ძირითად პირობებს უერთდება; ცალკე „პირობები მოკლედ“ მხოლოდ რამდენიმე ამონარიდისთვის ჩანს.

## Public URL spelling and automatic pagination

Known city, category and profession filters use Latin query values (for example `?city=tbilisi` and `?q=mdzgholi`). The UI and database filters stay Georgian; arbitrary search text is preserved. Old Georgian filter URLs permanently redirect to the equivalent Latin URL, preserving pagination and other parameters. Employer URLs reserve old names before assigning transliterated slugs so a collision cannot take over another employer's old address. Vacancy identifiers remain unchanged; their existing canonical redirect resolves old titles to the new spelling.

Automatic pagination requires a fresh downward user scroll near the end of the list. It adds one page at a time with at least 1.2 seconds between automatic requests; layout shifts and component rerenders do not request more pages. The load-more button remains available for manual loading and retries. Loading indicators do not insert temporary skeleton rows, and the footer is excluded from scroll anchoring.
