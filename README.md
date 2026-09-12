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
- ვაკანსიის გვერდზე მიმართულების ხელფასების შუალედი (p25–მედიანა–p75, `percentile_cont`), მხოლოდ ლარში და თვეზე; 8-ზე ნაკლებ ჩანაწერზე და „სხვა" კატეგორიაზე არ ჩანს.
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

სიის საწყისი ინტერვალია 30 წუთი; hr/jobs/ss-ის უკვე შემოტანილი დეტალები დღეში ერთხელ მოწმდება (სიიდან გამქრალი ჩანაწერები პირველ რიგში), ახალი ბმულები კი უახლესიდან ძველისკენ. თითო გაშვება შემოსაზღვრულია დროით (`SCRAPE_BUDGET_MINUTES`, ნაგულისხმევად 22) და რაოდენობით (`CRAWL_BATCH_SIZE`); დეტალებს სამი პარალელური მუშა ამუშავებს (`DETAIL_CONCURRENCY`), თუმცა ერთ ჰოსტზე მოთხოვნები არასდროს ერთდროულია: hr/jobs/ss-ზე წამში ერთი, დანარჩენზე ორ წამში ერთი, robots.txt-ის `Crawl-delay` კი უპირატესია (jobs.ge — 5 წამი). აღმოჩენილი ბმულების რაოდენობა **არ არის** შემოტანილი ვაკანსიების რაოდენობა.

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

საიტი: https://vakansiebi-gules.vercel.app — Vercel-ის `kapana22s-projects/vakansiebi` პროექტი.
ადმინი: https://vakansiebi-gules.vercel.app/admin.

PostgreSQL განთავსებულია Neon-ის პროექტში `plain-sky-34116949`, `production` ბრენჩზე. არსებული ლოკალური მონაცემები გადატანილია; ამ სამუშაო კომპიუტერის საიტი და პარსერი იმავე ბაზას იყენებს. ამიტომ ლოკალურ ადმინში გამოქვეყნებაც ონლაინ საიტზე აისახება. დამოუკიდებელი ექსპერიმენტებისთვის გამოიყენე ცალკე სატესტო ბაზა.

Vercel-ის Production გარემოში საჭიროა `DATABASE_URL` (Neon-ის pooled მისამართი), `APP_URL`, `ADMIN_PASSWORD_HASH` და `SESSION_SECRET`. მიგრაციებისა და მუდმივი პარსერისთვის გამოიყენე Neon-ის direct მისამართი. საიდუმლო მნიშვნელობები Git-ში არ ინახება; `.vercelignore` ადგილობრივ ბაზას, პაროლებსა და სარეზერვო ასლებს ატვირთვიდან გამორიცხავს.

The scraper runs in GitHub Actions (`.github/workflows/scrape.yml`) at minutes 17 and 47 of each hour. Each source respects its admin interval, enabled status and manual request. Admin requests are picked up by the next workflow run; Actions > Vacancy scraper > Run workflow also checks due sources. The local computer is no longer required.

`SCRAPER_DATABASE_URL` is a GitHub Actions secret containing the Neon direct connection URL; session advisory locks require the direct endpoint. Five independent jobs (hr, jobs, ss, gancxadebebi, myjobs) process up to 600 details per source, bounded by a 22-minute per-source budget inside a 35-minute job timeout; an unfinished batch is retained for the next run. Jobs.ge's robots.txt asks for a 5-second gap between requests, so it manages roughly 250 details per run; the other boards run at one request a second. GitHub's cron is best-effort: in practice the workflow ran 8–15 times a day, not 48, so a persistent host (the prepared Railway worker, `npm run worker`) is the way to make collection continuous.

The two government hosts are not in the matrix: `vacancy.hr.gov.ge` and `worknet.moh.gov.ge` both time out from every GitHub-hosted runner. They are collected from this Mac by `npm run worker:gov` (a terminal tab; one pass every 30 minutes over hrgov and worknet, advisory locks keep it from overlapping the workflow). `scripts/install-local-gov-sources.sh` registers the same pass as a launchd agent, but macOS privacy protection blocks a launchd agent from reading a project under `~/Desktop`: either grant Full Disk Access to `/bin/zsh` or move the project, otherwise use the terminal tab. The install script checks this and says which applies. Overlapping workflows queue, and database locks also protect against a local worker. Three consecutive detail failures stop that source's batch, retaining the remaining queue. A job fails only when the source itself needs attention: the run threw, the listing shape or reported coverage changed, three consecutive detail failures aborted the batch, or at least three pages and half the batch failed. Individual transient page failures and quality holds are posted as Actions warnings, keep the job green and still advance the source's last successful check, because the backoff retries them on its own. Every result remains visible in the admin history and the step summary. Sources with auto_publish enabled validate, publish, update and archive automatically. Invalid records wait for source recovery without a manual-review flag. The scraper never sends messages.

GitHub schedules may be delayed. In public repositories, schedules disable after 60 days without repository activity and must be re-enabled. Standard GitHub-hosted runners are free for this public repository; Neon usage is separate.

ამ Vercel პროექტში GitHub-ის ავტომატური განთავსების კავშირი ჯერ არ არის გამართული. განახლება CLI-ით ხდება: `vercel deploy --prod --scope kapana22s-projects`.

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

Vacancy details extract and display email addresses from the approved description, with a draft-email link and copy action. Recruitment context is distinguished from generic contact addresses. Mailto links inside source descriptions retain their recipient when converted to plain text; hidden cc/bcc/subject parameters from the source are not imported. The generated draft uses the position title and an editable Georgian body, with the applicant details saved in the personal workspace filled in when there are any. It opens the visitor's email client, which is where the visitor attaches the CV and sends it. No mail provider is configured and there is no direct site upload/send flow.

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

In **ადმინი → წყაროები და განახლება**, manage discovery, publication and source intervals; request a run for one/all enabled sources; retry pending description repairs; inspect GitHub and per-source history. The GitHub schedule requests a run every 30 minutes; GitHub may delay scheduled runs. Turning off automatic discovery leaves previously requested description repairs enabled; disabling the source stops both on subsequent batches.

Description repair gets at most 20 items / a 3-minute budget before due discovery runs. Failed repairs remain queued and emit warnings; they cannot starve discovery. Hard infrastructure errors still fail the worker. Discovery quality warnings remain visible in Actions and the admin history.

For immediate admin-to-GitHub dispatch, set server-only `GITHUB_ACTIONS_TOKEN` in Vercel Production: a fine-grained token restricted to `Webinfinity11/vakansiebi`, **Actions: read and write**, with an explicit expiry/rotation plan. No client environment variable. The endpoint is fixed to `scrape.yml` on `main`, requires an admin session and same-origin POST, and coalesces dispatches for 60 seconds using a database lock. If the token is missing or GitHub rejects a request, the durable queue remains and the UI explicitly says it is awaiting a scheduled run. Never copy a token into this README, a screenshot or a chat message.
