# Google Indexing API — კვლევა ვაკანსიის გვერდებისთვის — 2026-09-22

თავები 1–4 ასახავს 2026-09-22-ის კვლევას. კოდის დანერგვისა და ჩართვის განახლებული ინსტრუქცია იხილეთ მე-5 თავში (2026-09-23). Credentials და production არ შეცვლილა.

## 1. ფაქტები, წყაროებით

- **მხარდაჭერილი შემცველობა.** Indexing API ოფიციალურად განკუთვნილია მხოლოდ ორი ტიპის გვერდისთვის: `JobPosting` structured data-ს შემცველი გვერდები და `VideoObject`-ში chained `BroadcastEvent`-ის შემცველი გვერდები. API ტექნიკურად იღებს ნებისმიერ URL-ს და აბრუნებს 200-ს მისი schema-ს შემოწმების გარეშე — რეალური ვალიდაცია crawl/index ეტაპზეა, ასე რომ სხვა URL-ის გაგზავნა "მუშაობს" ტექნიკურად, მაგრამ მხარდაუჭერელია. ჩვენს შემთხვევაში `app/vacancies/[id]/page.tsx` უკვე აწარმოებს ვალიდურ `JobPosting`-ს (Search Console: 3 valid, 0 invalid) — ანუ ზუსტად დაშვებულ შემთხვევაშივე ვართ.
  წყარო: [How to Use the Indexing API](https://developers.google.com/search/apis/indexing-api/v3/using-api)

- **დღიური კვოტა.** ნაგულისხმევი **200 `publish` მოთხოვნა დღეში** (`URL_UPDATED` და `URL_DELETED` ერთად ითვლება), Cloud-პროექტის დონეზე, დღის დასაწყისი Pacific Time-ის შუაღამეზეა. ცალკე per-minute ლიმიტებია: 180 read-only მოთხოვნა/წთ, 380 ჯამში ყველა endpoint-ზე/წთ. Batch-ში 10 მოთხოვნის გაერთიანება მაინც 10-ად ითვლება კვოტაში.
  წყარო: [Requesting Approval and Quota](https://developers.google.com/search/apis/indexing-api/v3/quota-pricing)

- **კვოტის გაზრდა.** 200-ზე მეტი მხოლოდ [დამტკიცების ფორმის](https://developers.google.com/search/apis/indexing-api/v3/quota-pricing) შევსებით შესაძლებელია, და მხოლოდ `JobPosting`/`BroadcastEvent` გამოყენებისთვის. დოკუმენტაცია ამბობს, კვოტა "შეიძლება გაიზარდოს ან შემცირდეს დოკუმენტის ხარისხის მიხედვით" — ზუსტი ფორმულა თუ გარანტირებული ზედა ზღვარი არსად წერია. დამტკიცების ან უარყოფის კონკრეტული კრიტერიუმები საჯაროდ არ არის გამოქვეყნებული.

- **URL_UPDATED vs URL_DELETED.** `URL_UPDATED` — ახალი ან შეცვლილი გვერდის (თავიდან) crawl-ის მოთხოვნაა. `URL_DELETED`-ის წინაპირობაა, რომ URL უკვე აბრუნებდეს **404/410**-ს ან შეიცავდეს `<meta name="robots" content="noindex">`-ს — წინასწარ, გაგზავნამდე.
  წყარო: [How to Use the Indexing API](https://developers.google.com/search/apis/indexing-api/v3/using-api)

- **მოთხოვნის ფორმატი.** `POST https://indexing.googleapis.com/v3/urlNotifications:publish`, `Content-Type: application/json`, სხეული `{"url":"...","type":"URL_UPDATED"|"URL_DELETED"}`.

- **ავტორიზაცია — თანმხლები დამოკიდებულების გარეშეც შესაძლებელია.** სქემა: service account-ის RSA კერძო გასაღებით ხელმოწერილი JWT (RS256, scope `https://www.googleapis.com/auth/indexing`), გაცვლილი `https://oauth2.googleapis.com/token`-ზე (`grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer`) access token-ზე (ვადა ≤1სთ). ხელმოწერა შესაძლებელია Node-ის ჩაშენებული `node:crypto`-ს `createSign('RSA-SHA256')`-ით — **googleapis/google-auth-library პაკეტი არ სჭირდება**.
  წყარო: [Using OAuth 2.0 for Server to Server Applications](https://developers.google.com/identity/protocols/oauth2/service-account), community მაგალითი: [Rolling a Google Service Account JWT in Node.js without googleapis](https://dev.to/morinaga/rolling-a-google-service-account-jwt-in-nodejs-without-the-googleapis-package-22am)

- **წესების დარღვევის შედეგები დოკუმენტირებული არ არის.** არც rate-limit-ის ქცევაზეა რამე ნათქვამი გადაჭარბებისას, არც suspension-ზე მხარდაუჭერელი შემცველობის გაგზავნისთვის — უბრალოდ ხაზგასმულია, რომ API განკუთვნილია მხოლოდ ამ ორი ტიპისთვის.

- **ფასი.** უფასოა.

## 2. ტექნიკური მოთხოვნები — რა ღილაკებზე დააჭიროთ

ეს ნაწილი თქვენთვისაა — მე ანგარიშებს არ ვქმნი და credentials-ს არსად არ ვინახავ.

1. **Google Cloud პროექტი.** console.cloud.google.com → შექმენით ახალი პროექტი (ან გამოიყენეთ არსებული, თუ გაქვთ jobx.ge-სთვის ცალკე). Indexing API თავად უფასოა და არ საჭიროებს ბილინგს მისი ჩართვისთვის — თუ Cloud Console billing-ის მიბმას სთხოვს პროექტის შექმნისას, ბარათის დამატება საკმარისია, ხარჯი არ დაერიცხებათ ამ API-ის გამო.
2. **API-ის ჩართვა.** APIs & Services → Library → მოძებნეთ "Indexing API" → Enable.
3. **Service account.** IAM & Admin → Service Accounts → Create Service Account → სახელი (მაგ. `jobx-indexing`) → Continue → Done (როლის მინიჭება ამ ეტაპზე არ სჭირდება, Search Console-ის უფლება ცალკეა).
4. **JSON გასაღები.** გახსენით ახლადშექმნილი service account → Keys → Add Key → Create new key → JSON → Create. ჩამოიწევს ფაილი, რომელშიც `client_email` და `private_key` ველებია საჭირო. **ეს ფაილი არსად არ ატვირთოთ, არც ამ საუბარში ჩააკოპირო** — პირდაპირ Vercel-ის env-ში შეინახეთ (`vercel env add`), ორ ცვლადად გაყოფილი: client_email და private_key.
5. **Search Console-ში owner-ად დამატება.** Search Console → `jobx.ge` property → პარამეტრები (მარცხნივ ქვედა კუთხის კბილანა) → Users and permissions → Add user → ჩასვით service account-ის `client_email` (ფორმატი `xxx@project-id.iam.gserviceaccount.com`) → Permission: **Owner** (არა Full/Restricted — Indexing API მხოლოდ Owner-ს იღებს).
6. **კვოტის გაზრდის მოთხოვნა.** შეავსეთ დამტკიცების ფორმა (ბმული ზემოთ, quota-pricing გვერდზე) — მიუთითეთ, რომ jobx.ge ვაკანსიების საიტია, დღეში ~350-450 ახალი `JobPosting` გვერდი ქვეყნდება (იხ. ქვემოთ), და structured data უკვე ვალიდურია Search Console-ში.

## 3. ღირს თუ არა — შეფასება 11,882 ვაკანსიის ფონზე

**რაოდენობრივი სურათი (docs/scraper-status-2026-09-21.md-დან):** ახალი გამოქვეყნებული ვაკანსია **დღეში ~350-450**-ია (09-18: 359, 09-19: 443, 09-20 ნახევარდღეზე უკვე 32 და გაუთავებელი). ეს **უკვე აღემატება ნაგულისხმევ 200/დღეში** კვოტას მხოლოდ `URL_UPDATED`-ისთვის, ჯერ კიდევ `URL_DELETED`-ის (archived ვაკანსიებზე) დათვლის გარეშე. ანუ ნაგულისხმევი კვოტა პირველივე დღიდან საკმარისი არ იქნება — კვოტის გაზრდის მოთხოვნა სავალდებულოა, არა სურვილისამებრ.

**11,882 არსებული გვერდის backfill — არ ღირს.** ეს რაოდენობა 60x აღემატება ნაგულისხმევ კვოტას და მრავალჯერ აღემატება ნებისმიერ რეალისტურ გაზრდილ კვოტასაც. Indexing API არ არის ბალკ-დისკავერი მექანიზმი — ეს ფუნქცია უკვე sitemap-ს აქვს (`sitemap-jobs.xml`, 11,882 URL, 200-ით პასუხობს). API-ის ღირებულება არის **ცვლილების მაუწყებლობა** ("ეს კონკრეტული URL ახალია/წაშლილია ახლა"), არა ინვენტარის სრული სია.

**რატომ ღირს მაინც (ახალი, incremental ნაკადისთვის):**
- ეს ზუსტად ის შემთხვევაა, რისთვისაც Google ამ API-ს აშენებს — ვაკანსიის გვერდები, ვალიდური `JobPosting` markup-ით.
- საიტი ახალია (პირველი commit 09-07, GSC property 09-18-დან), crawl budget თხელია (დაფიქსირებული 23-164 მოთხოვნა/დღეში), sitemap discovery ამჟამად "Temporary processing error"/"Couldn't fetch" მდგომარეობაშია (`docs/search-console-audit-2026-09-19.md`, `docs/search-console-audit-2026-09-20.md`) — Indexing API sitemap-ისგან დამოუკიდებელი, პირდაპირი გზაა Google-მდე, ეს პრობლემა სანამ არ მოგვარდება.
- ვაკანსია ცხოვრობს ~თვეს; ვადაგასული/წაშლილი ვაკანსიის სწრაფი მოხსნა (`URL_DELETED`) ამცირებს რისკს, რომ Google მკვდარ JobPosting-ს დიდხანს აჩვენებდეს ძებნაში — რასაც Google-ის საკუთარი JobPosting-გაიდლაინები პირდაპირ ასახელებენ პრობლემად.
- API უფასოა — ღირებულება მხოლოდ განხორციელების დროა.

**რისკი, რომელიც გასათვალისწინებელია:** კვოტის გაზრდაზე უარი შეიძლება მოვიდეს, ან ნაწილობრივი დამტკიცება (მაგ. 500/დღეში 350-450-ის საჭიროებაზე — საკმარისი, მაგრამ არ ვიცით წინასწარ). დამტკიცების კრიტერიუმები საჯარო არ არის. ამიტომ დიზაინი ქვემოთ ისეა აგებული, რომ კვოტის ამოწურვისას **არაფერი გატყდეს** — sitemap რჩება fallback discovery-დ ყოველთვის.

**დასკვნა: ღირს**, incremental ნაკადისთვის (ახალი publish + archive მოვლენებზე), backfill-ის გარეშე, კვოტის მკაცრი ბიუჯეტირებით და fail-open (skip, არა crash) ქცევით შეცდომაზე.

## 4. დანერგვის გეგმა (დაპროექტება — კოდი არ დაწერილა)

**ახალი ფაილი:** `lib/server/google-indexing.ts`
- JWT აწყობა და ხელმოწერა `node:crypto`-ს `createSign('RSA-SHA256')`-ით (დამატებითი dependency არ სჭირდება).
- Token exchange `fetch`-ით `https://oauth2.googleapis.com/token`-ზე, in-memory cache (access token ვადა ≤1სთ, worker-ის ერთ გაშვებაში საკმარისია).
- `publish(url: string, type: 'URL_UPDATED' | 'URL_DELETED'): Promise<void>` — `fetch` `urlNotifications:publish`-ზე; ქსელის/429/401 შეცდომაზე **მხოლოდ log, არასდროს throw** — worker-ის მთავარ ნაკადს ეს გვერდითი ეფექტია და მისი ჩავარდნა ვაკანსიის publish/archive ტრანზაქციას არ უნდა შეაჩეროს.

**Env ცვლადები (მომხმარებელი ავსებს Vercel-ში, ნაბიჯი 4 ზემოთ):** `GOOGLE_INDEXING_CLIENT_EMAIL`, `GOOGLE_INDEXING_PRIVATE_KEY`.

**სად ჩაერთვება (არსებული status-გადასვლები, არცერთი დღეს არ შეცვლილა):**
- `worker/automation.ts:118` და `lib/server/jobs.ts:609` — `status='published'`-ზე გადასვლისას (ავტომატური scraping და მანუალური/ფასიანი submission ორივე) → commit-ის შემდეგ `publish(vacancyPath(...), 'URL_UPDATED')`.
- `worker/automation.ts:141` და `lib/server/jobs.ts:615` — `status='archived'`-ზე გადასვლისას → commit-ის შემდეგ `publish(vacancyPath(...), 'URL_DELETED')`. `app/vacancies/[id]/page.tsx`-ის `notFound()` (:31, job query-ს მხოლოდ published აბრუნებს) უზრუნველყოფს, რომ URL ამ მომენტში უკვე 404-ობს — ეს ემთხვევა Google-ის `URL_DELETED`-წინაპირობას ზუსტად. `worker/purge.ts`-ში ჩართვა **არასწორი იქნებოდა** — purge მხოლოდ 1-7 დღის დაგვიანებით ფიზიკურად შლის DB-row-ს, გვერდი მანამდე უკვე დიდი ხანია 404-ია.

**დღიური ბიუჯეტის დაცვა.** Worker არ არის long-lived პროცესი (GitHub Actions cron), ამიტომ in-memory counter არ მუშაობს — საჭირო იქნება მცირე DB მთვლელი (მაგ. `indexing_requests(date, count)` ან არსებული settings/kv ცხრილის ხელახლა გამოყენება, თუ ასეთი არსებობს). ეს **ახალ migration-ს საჭიროებს** — `db/migrations/`-ს ამჟამად სხვა ნაკადი იყენებს (CV/ანალიტიკის თემა, `035_analytics_resume_kind.sql` უკვე open), ამიტომ ეს ნაბიჯი ცალკე, კოორდინირებულად უნდა დაემატოს, ამ ნაკადის დასრულების შემდეგ. კვოტის ამოწურვისას მოთხოვნა უბრალოდ **გამოტოვდეს** (log-ით), crash არა — sitemap ისედაც მოიცავს ყველა URL-ს fallback-ად.

**ტესტები.** `tests/analytics.test.ts`-ის სტილში (`node:test` + `assert/strict`, DB-ს გარეშე) — JWT-ის აწყობის/URL-არჩევის ლოგიკაზე unit ტესტი, ქსელური გამოძახების გარეშე.

**გარეთ დარჩა განზრახ:** 11,882 არსებული გვერდის backfill; `worker/purge.ts`-ში ჩართვა.


## 5. დანერგვა და ჩართვა — 2026-09-23

დაემატა `lib/server/google-indexing.ts`, `037_google_indexing_daily.sql` და შეტყობინებები ახალი გამოქვეყნების/არქივში გადასვლისას. Worker (`worker/automation.ts`, `worker/importer.ts`, `worker/refresh.ts`, `worker/run.ts`) და ადმინისტრატორის publish/archive მოქმედებები (`lib/server/jobs.ts`) აგზავნის მხოლოდ ტრანზაქციის commit-ის შემდეგ. უცვლელი ვაკანსიის ხელახალი reconciliation შეტყობინებას არ აგზავნის; არსებული ვაკანსიების backfill არ არის.

**მთავარი გზა — GitHub Secrets.** Worker ეშვება GitHub Actions-ის `.github/workflows/scrape.yml`-ში. Repository → Settings → Secrets and variables → Actions → Secrets-ში დაამატეთ:

- `GOOGLE_INDEXING_CLIENT_EMAIL` — service account-ის `client_email`.
- `GOOGLE_INDEXING_PRIVATE_KEY` — იმავე ანგარიშის `private_key`; მიიღება როგორც ნამდვილი მრავალსტრიქონიანი მნიშვნელობა, ასევე JSON-იდან აღებული escaped newline-ები.

Workflow ამ ორ secret-ს worker-ის env-ში გადასცემს. რომელიმე ცვლადის არქონისას მოდული ჩუმად გამორთულია: არც ქსელური მოთხოვნა, არც ბიუჯეტის DB-მოთხოვნა. მნიშვნელობები workflow-ში, კოდში ან დოკუმენტში არ ჩაწეროთ. Google Cloud-ში API-ის ჩართვა და Search Console-ში service account-ის Owner უფლება კვლავ საჭიროა (თავი 2).

**Vercel — საჭიროების შემთხვევაში.** იგივე ორი ცვლადი დაამატეთ პროექტის Environment Variables-ში, თუ გინდათ ადმინისტრატორის publish/archive მოქმედებებმაც გააგზავნოს შეტყობინებები. მხოლოდ Vercel-ზე დამატება worker-ის ინტეგრაციას არ ჩართავს: GitHub Actions Vercel-ის env-ს არ კითხულობს. Vercel-ის env ცვლილების ასახვას ცალკე redeploy სჭირდება; ამ სამუშაოში redeploy არ შესრულებულა.

**მიგრაცია.** ჩართვამდე სამიზნე ბაზას უნდა ჰქონდეს `037_google_indexing_daily.sql`. ამ სამუშაოში მიგრაცია გაეშვა მხოლოდ ლოკალურ `ertad_test`-ზე. Production მიგრაცია არ შესრულებულა. თუ ცხრილი აკლია, შეტყობინება ლოგით გამოტოვდება და ძირითადი მოქმედება წარმატებით გაგრძელდება.

**კვოტა.** `GOOGLE_INDEXING_DAILY_LIMIT` worker/server პროცესის არჩევითი env-ია, ნაგულისხმევად `200`; `0` აჩერებს გაგზავნას. GitHub workflow-ში ამ ცვლილებით მხოლოდ ზემოთ ჩამოთვლილი ორი credential გადადის, ამიტომ cron იყენებს ნაგულისხმევ 200-ს; განსხვავებული ლიმიტის გამოსაყენებლად ის ცალკე უნდა გადაეცეს worker-ის env-ს. ეს არის ჩვენი ლოკალური ბიუჯეტი და Google-ის რეალურ კვოტას არ ზრდის. ორივე ტიპის მოთხოვნა ერთ ატომურ DB-მთვლელს იყენებს; დღე იცვლება `America/Los_Angeles`-ის შუაღამისას, ზაფხულის/ზამთრის დროის გათვალისწინებით. ერთი Cloud პროექტის სხვა მომხმარებლების მოთხოვნები ამ მთვლელში არ ჩანს.

ლიმიტის ამოწურვისას publish ჩუმად გამოტოვდება, რიგში არ ინახება და მეორე დღეს ავტომატურად არ იგზავნება. უკვე გაგზავნილი მცდელობა HTTP შეცდომის/timeout-ის შემთხვევაშიც ითვლება; გაურკვეველი შედეგის დაბრუნება ბიუჯეტში გადაჭარბებას შექმნიდა. OAuth token ქეშირდება ვადის ამოწურვამდე მცირე მარაგით; პარალელური მოთხოვნები ერთ token exchange-ს იყენებს. ქსელურ მოთხოვნებს აქვს 5-წამიანი timeout. შეცდომა მხოლოდ მოკლე, გასაღებისა და პასუხის სხეულის გარეშე ილოგება და worker-ს/ადმინისტრატორის ძირითად მოქმედებას არ აჩერებს.

**წაშლის წინაპირობა.** `worker/purge.ts` უცვლელია: ის უკვე არქივირებული რიგების ფიზიკურ წაშლას აგვიანებს. არქივში გადასვლის შემდეგ მოწმდება უშუალოდ საჯარო URL, redirect-ის მიყოლის გარეშე: `URL_DELETED` იგზავნება მხოლოდ 404/410-ზე ან 200 HTML-ში ნამდვილ `robots: noindex` meta ელემენტზე. ჩვეულებრივი 200, redirect და გაურკვეველი პასუხი გამოტოვდება; ასეთ გამოტოვებას განმეორებითი რიგი არ აქვს. ეს აზუსტებს მე-4 თავში აღწერილ წინასწარ ვარაუდს, რომ DB სტატუსი თავისთავად გარანტირებული 404 იქნებოდა. [Google-ის წაშლის წინაპირობა](https://developers.google.com/search/apis/indexing-api/v3/using-api).

ტესტებში გამოიყენება მხოლოდ მეხსიერებაში გენერირებული სატესტო RSA წყვილი და ყალბი HTTP პასუხები; რეალური გასაღები ან Google-ის ქსელური გამოძახება არ გამოიყენება.

### შემოწმება

- `npm run typecheck`, `npm run lint` — სუფთა.
- Indexing-ის მიზნობრივი ტესტები (`RUN_DB_TESTS=1`, მხოლოდ `ertad_test`) — 14 pass: JWT ხელმოწერა, token cache, disabled რეჟიმი, ლიმიტი/კონკურენცია/Pacific DST, წაშლის წინაპირობა, fail-open და რეალური DB ტრანზაქციის commit/rollback.
- ჩვეულებრივი `npm test` (`RUN_DB_TESTS=0`) — სუფთა; DB ტესტები ამ რეჟიმში გამოტოვებულია.
- გაფართოებულ საერთო DB ნაკრებში 7 არსებული ჩავარდნაა: `description-refresh-integration`, `integration`, `listing-hints-integration`, `quality-integration`, `scraper-pagination-integration`, `ss-minimal-integration`, `submission-logos-integration`. იგივე შვიდივე გამეორდა დროებით, უცვლელ `HEAD` ასლზე; მათ კოდს ეს სამუშაო არ ცვლის.
- `.github/workflows/scrape.yml`-ის diff ზუსტად ორი დამატებული env ხაზია. `deploy.yml`, production ბაზა/env და სხვა ნაკადების ფაილები არ შეცვლილა. Commit/push/deploy არ შესრულებულა.
