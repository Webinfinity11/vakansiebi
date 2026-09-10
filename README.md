# ერთად — ვაკანსიების აგრეგატორი

ქართული ვაკანსიების ერთიანი ძებნა, წყაროების პერიოდული პარსინგი და ავტომატური შემოწმება და გამოქვეყნება.

**ამ ეტაპზე სატესტო პროდუქტია. შეტყობინებების გაგზავნა საერთოდ არ არის დაკავშირებული. შემოტანა არაფერს აქვეყნებს ავტომატურად.**

## რა მუშაობს

- Next.js / React ინტერფეისი: ძებნა, ქალაქი, მიმართულება, დისტანციური სამუშაო, ხელფასი, წყარო და გვერდები.
- PostgreSQL ბაზა და ცალკე Node.js ფონური პროცესი.
- `hr.ge`: საჯარო HTML და გვერდში არსებული announcement მონაცემები; დამალულ ხელფასსა და დამალულ საკონტაქტო ველებს არ იღებს.
- `jobs.ss.ge`: საჯარო ვაკანსიები, დამსაქმებლის ლოგო და განაცხადის ბმული.
- `vacancy.hr.gov.ge`: საჯარო სამსახურის ვაკანსიები, პირობები და ბოლო ვადა.
- `jobs.ge`: საჯარო HTML განცხადებების სია და დეტალები.
- დამატებითი აღმოჩენა HR.ge-ს sitemap-ებიდან და SS / საჯარო სამსახურის სიის გვერდებიდან; გვერდები ნაწილდება გაშვებებს შორის.
- შემოტანილი ვაკანსიის რედაქცია, ხელით გამოქვეყნება, არქივი, უარყოფა და აღდგენა.
- წყაროს ბოლო ტექსტი, ადმინის რედაქცია და საჯარო ვერსია ინახება განცალკევებით. პარსერი რედაქციას არ გადაწერს.
- შესაძლო დუბლიკატები კომპანიის, პოზიციისა და ქალაქის ნორმალიზებული დამთხვევით; ადმინის მიერ გაერთიანებისას ყველა პირველწყარო რჩება.
- წყაროს ჩართვა/გამორთვა, ინტერვალი, ხელით შემოწმების რიგი და შემოტანის ისტორია.
- პაროლით დაცული ადმინი, ხელმოწერილი HttpOnly სესია, same-origin შემოწმება და შესვლის მცდელობების ლიმიტი.
- `/api/jobs?preview=1` და `/?preview=1` აჩვენებს გამოუქვეყნებელ ჩანაწერებს მხოლოდ ავტორიზებულ ადმინს.

## ლოკალურად გაშვება

განახლებულ ინტერფეისში ვაკანსია ინახება ამ ბრაუზერში; გაზიარება იყენებს `/?job=UUID` ბმულს და მხოლოდ საჯარო ვაკანსიას აჩვენებს. დეტალებში ჩანს ლოგო, განაკვეთი, დამატებითი პირობები და აღწერის ბმულები. კომპანიის საერთო პროფილი (ლოგო, ოფიციალური საიტი, აღწერა) ადმინიდან ხელით იმართება და ყველა შესაბამის ვაკანსიაზე მოქმედებს.

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

სიის საწყისი ინტერვალია 30 წუთი; უკვე შემოტანილი დეტალების შემოწმება ინიშნება 6 საათში. მიმდინარე ვერსია თითო გაშვებაზე ამუშავებს შეზღუდულ ნაკადს (`CRAWL_BATCH_SIZE=20`), ამიტომ დიდი საწყისი რიგის ამოწურვა რამდენიმე გაშვებას მოითხოვს. აღმოჩენილი ბმულების რაოდენობა **არ არის** შემოტანილი ვაკანსიების რაოდენობა.

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

ტესტები ამოწმებს პარსერებს, URL-ების შეზღუდვას, პაროლსა და სესიას, შემოტანილი/გამოქვეყნებული ტექსტების განცალკევებას, ერთდროული ცვლილებების კონფლიქტს, დუბლიკატების გაერთიანებასა და ვადაგასული ჩანაწერების გამორიცხვას. ინტეგრაციული ტესტი ნაგულისხმევად გამოტოვებულია, რათა სამუშაო ბაზა არ შეცვალოს.

## მიმდინარე ონლაინ გარემო

საიტი: https://vakansiebi-gules.vercel.app — Vercel-ის `kapana22s-projects/vakansiebi` პროექტი.
ადმინი: https://vakansiebi-gules.vercel.app/admin.

PostgreSQL განთავსებულია Neon-ის პროექტში `plain-sky-34116949`, `production` ბრენჩზე. არსებული ლოკალური მონაცემები გადატანილია; ამ სამუშაო კომპიუტერის საიტი და პარსერი იმავე ბაზას იყენებს. ამიტომ ლოკალურ ადმინში გამოქვეყნებაც ონლაინ საიტზე აისახება. დამოუკიდებელი ექსპერიმენტებისთვის გამოიყენე ცალკე სატესტო ბაზა.

Vercel-ის Production გარემოში საჭიროა `DATABASE_URL` (Neon-ის pooled მისამართი), `APP_URL`, `ADMIN_PASSWORD_HASH` და `SESSION_SECRET`. მიგრაციებისა და მუდმივი პარსერისთვის გამოიყენე Neon-ის direct მისამართი. საიდუმლო მნიშვნელობები Git-ში არ ინახება; `.vercelignore` ადგილობრივ ბაზას, პაროლებსა და სარეზერვო ასლებს ატვირთვიდან გამორიცხავს.

The scraper runs in GitHub Actions (`.github/workflows/scrape.yml`) at minutes 17 and 47 of each hour. Each source respects its admin interval, enabled status and manual request. Admin requests are picked up by the next workflow run; Actions > Vacancy scraper > Run workflow also checks due sources. The local computer is no longer required.

`SCRAPER_DATABASE_URL` is a GitHub Actions secret containing the Neon direct connection URL; session advisory locks require the direct endpoint. Four independent jobs process up to 50 details per source. Overlapping workflows queue, and database locks also protect against a local worker. Three consecutive detail failures stop that source's batch, retaining the remaining queue. Partial and failed results appear as failed Actions jobs and remain visible in the admin history. Sources with auto_publish enabled validate, publish, update and archive automatically. Invalid records wait for source recovery without a manual-review flag. The scraper never sends messages.

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
- ავტომატური კატეგორიზაცია სათაურის წესებზეა დაფუძნებული და ადმინის შემოწმებას საჭიროებს.
- დუბლიკატების დამთხვევა კანდიდატებს აჩვენებს; სხვადასხვა ენით დაწერილი კომპანიების/პოზიციების სემანტიკური შედარება ჯერ არ კეთდება.
- ხელფასით დალაგება პირველ რიგში მხოლოდ მკაფიოდ მითითებულ თვიურ GEL თანხებს ადარებს. საათობრივ/წლიურ თანხებსა და უცხოურ ვალუტებს არ ურევს.
- ავტომატურად მართვადი ჩანაწერები ქვეყნდება, ახლდება და არქივდება. ხელით შესწორება კონკრეტული ჩანაწერის ავტომატიზაციას აჩერებს.
- robots.txt-ის გათვალისწინება არ უდრის კონტენტის ხელახალი გავრცელების უფლებას. ფართო საჯარო გაშვებამდე თითოეული წყაროს პირობები ცალკე უნდა შეთანხმდეს.
- GitHub-ში არ იტვირთება `.env`, ადმინისტრატორის პაროლი, `.local`, ბაზები, ჩამოტვირთული HTML ან build/cache ფაილები.

GitHub verification (2026-09-09): HR, Jobs and SS imported 43 new pending vacancies in total. The government source timed out connecting from GitHub (`UND_ERR_CONNECT_TIMEOUT`) on two attempts, while responding locally. Its existing data is retained; scheduled retries follow the source backoff. This is an unresolved network reachability limitation, not a successful government-source cloud import. Removed HTTP 404/410 detail pages are rechecked after seven days and linked pending/published jobs are flagged for manual review.

## Vacancy discovery and trust logic

Search matches all normalized query terms across title, employer, city and description, regardless of word order. Relevance ordering gives title matches more weight than employer matches; recency breaks ties. Users can also explicitly sort by latest, comparable monthly GEL salary, or earliest deadline (unknown deadlines last).

Public provenance shows each source's last check and distinguishes recent successful checks (48 hours), older checks and failed checks. A successful fetch is not a guarantee that an employer is still accepting applications. Changes detected after publication are flagged while the approved public text is retained.

New imports from different sources can share a pending draft only when exactly one candidate has matching content, employer, city, dates, compensation, mode, employment type, facts and application links. Identical concurrent imports are serialized by a transaction lock. An automatically published candidate can also be linked; manually controlled, ambiguous, different-cycle and same-source postings are not automatically merged. Existing manual moderation and merge controls remain available.

## Personal workspace (no registration)

The results toolbar saves the current filters; the header's personal workspace opens saved searches and manual application history. Job details offer planned/applied/interview/closed stages. Stage changes do not submit a CV or contact an employer. Application snapshots remain in the personal list when public listings disappear. Searches restore all filters and return to the first results page.

Records live only in this browser and origin, with limits of 20 searches and 200 applications. Clearing site data removes them; another device/domain has a separate collection. Individual versioned storage keys, validation, cross-tab refresh, visible save failures and delete undo protect everyday use. Existing bookmarks remain separate and unchanged. No public account, login, notification subscription or personal-data API is added. Research and tradeoffs: [docs/personal-space-research.md](docs/personal-space-research.md).

## Application contact shortcuts

Vacancy details extract and display email addresses from the approved description, with a draft-email link and copy action. Recruitment context is distinguished from generic contact addresses. Mailto links inside source descriptions retain their recipient when converted to plain text; hidden cc/bcc/subject parameters from the source are not imported. The generated draft uses the position title and an editable Georgian body. It opens the visitor's email client, which is where the visitor attaches the CV and sends it. No mail provider is configured and there is no direct site upload/send flow.

English-dominant descriptions offer an explicitly labelled external Google Translate website link. Original text remains available; this is not an in-site or human-verified Georgian translation. No private CV data is sent to translation services.

## Automatic lifecycle

See [automation rules](docs/automation.md). Migration 007 adds opt-in source publication and per-job automation state. Existing editorial overrides are preserved.

### Stored salary enrichment

`npx tsx scripts/enrich-existing.ts` previews additive pay extraction across currently searchable jobs in batches of 100. Use `--apply` to write validated changes and audit entries. By default only automatically managed, unpaused jobs are eligible. An explicit `--include-editorial` also fills missing pay and adds source-text pay excerpts to editorial/paused records; it preserves existing salary text, publication state and automation flags. This option is for an intentional catalogue repair, not a scheduled override of editorial choices. Source advisory locks prevent overlap with crawlers. No source verification timestamp is advanced because this operation only reinterprets stored text.

Source comparison and recovery scope: [2026-09-10 audit](docs/source-audit-2026-09-10.md).
