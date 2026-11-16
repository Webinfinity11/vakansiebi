# jobx.ge ინდექსაციის კვლევა 2026 წლის 9 ნოემბერი

საიტი ინდექსირდება: Search Console-ის 6 ნოემბრით განახლებულ ანგარიშში 3 251 ინდექსირებული გვერდია. Sitemap-ების `Couldn't fetch` სტატუსი კვლავ მოუგვარებელია, თუმცა მთავარი sitemap და ვაკანსიების sitemap Google-ის ცოცხალ ტესტს წარმატებით გადის. მათი დამუშავების შეფერხების კონკრეტული მიზეზი ანგარიშში არ ჩანს.

12 ნოემბერს ოფიციალური Search Console API-ით დადასტურდა: ხუთივე გაგზავნილ sitemap-ზე `isPending: true`, `errors: "0"`, `warnings: "0"`; `lastDownloaded` არ არის მოცემული. ეს ნიშნავს, რომ sitemap-ები დამუშავებული არ არის. დაყოვნების მიზეზი და გამოსწორების ვადა ამ პასუხით არ დგინდება.

ცალკე დადასტურდა კოდის ხარვეზი: Indexing API-ზე იგზავნება ვაკანსიების დუბლიკატი მისამართებიც, რომელთა canonical სხვა გვერდს უთითებს. ლოკალური შესწორება ასეთ შეტყობინებებს გაგზავნამდე აჩერებს. ეს ამცირებს დღიური კვოტის ფუჭ ხარჯვას; sitemap-ის დამუშავების პრობლემის გამოსწორებას ან გვერდების ავტომატურ ინდექსაციას არ ადასტურებს.

## Search Console-ის მიმდინარე მონაცემები

წყარო: ავტორიზებული [Pages ანგარიში](https://search.google.com/search-console/index?resource_id=https%3A%2F%2Fjobx.ge%2F), შემოწმებული 9 ნოემბერს. ანგარიშის ბოლო განახლება: 6 ნოემბერი. ზუსტი რაოდენობები აღებულია ბარათების `title` მნიშვნელობებიდან.

| სტატუსი                              | გვერდების რაოდენობა |
| ------------------------------------ | ------------------: |
| ინდექსირებული                        |               3 251 |
| არაინდექსირებული                     |               3 025 |
| Crawled — currently not indexed      |               1 464 |
| Not found 404                        |               1 014 |
| Excluded by noindex tag              |                 451 |
| Page with redirect                   |                  58 |
| Alternate page with proper canonical |                  22 |
| Server error 5xx                     |                  10 |
| Google chose different canonical     |                   5 |
| Redirect error                       |                   1 |

ბოლო რვა სტრიქონი არაინდექსირებული გვერდების ჯგუფებია. მათი ჯამი 3 025-ია; ყველა მათგანი გასასწორებელ შეცდომას არ ნიშნავს. მაგალითად, `/?q=mtargmneli` განზრახ აბრუნებს `noindex, follow`-ს. ქვემოთ მითითებული წაშლილი ვაკანსია ახლა ნამდვილად 404-ს აბრუნებს.

ანგარიში ინდივიდუალურ URL Inspection-ს შეიძლება ჩამორჩებოდეს: `Crawled — currently not indexed` სიაში ნაჩვენები [მაღაზიის ადმინისტრატორის ვაკანსია](https://jobx.ge/vacancies/maghaziis-administratori-8567ebd9-4649-4e3a-b3b0-3ed0988be39c) უშუალო შემოწმებაში უკვე `URL is on Google / Page is indexed` იყო. მთავარი გვერდიც ინდექსირებულია; ბოლო დაფიქსირებული სკანირება 8 ნოემბერს, 20:03:04-ზეა, Google-ის არჩეული canonical ემთხვევა მთავარ გვერდს.

## Sitemap-ის შემოწმება

[Sitemaps ანგარიშში](https://search.google.com/search-console/sitemaps?resource_id=https%3A%2F%2Fjobx.ge%2F) ხუთივე გაგზავნილი ფაილი აჩვენებს `Unknown`, `Couldn't fetch` და 0 აღმოჩენილ გვერდს. დეტალებში წერია მხოლოდ `Sitemap could not be read`; კონკრეტული HTTP ან XML parsing შეცდომა არ არის მოცემული. მთავარ გვერდზე URL Inspection-ის Discovery ნაწილში კვლავ `Temporary processing error` ჩანს.

| შემოწმება                                         | შედეგი                                                |
| ------------------------------------------------- | ----------------------------------------------------- |
| sitemap.xml ჩვეულებრივი Googlebot-ის ისტორია      | წარმატებული fetch, 2 ოქტომბერი 23:15:28               |
| sitemap.xml Google live test                      | წარმატებული fetch, crawl allowed, 9 ნოემბერი 12:51:10 |
| sitemap-jobs.xml ჩვეულებრივი Googlebot-ის ისტორია | წარმატებული fetch, 26 ოქტომბერი 00:21:44              |
| sitemap-jobs.xml Google live test                 | წარმატებული fetch, crawl allowed, 9 ნოემბერი 12:54:56 |

ცოცხალი ტესტების დრო მითითებულია თბილისის სესიაში. XML-ის `Crawled — currently not indexed` სტატუსი, როგორც საძიებო შედეგის გვერდისა, sitemap-ის დამუშავების შედეგი არ არის. Live Test-ის წარმატებაც მხოლოდ ამ მოთხოვნის ხელმისაწვდომობას ადასტურებს.

პირდაპირი HTTP შემოწმება Googlebot user-agent-ით:

| ფაილი                  | HTTP |      XML ჩანაწერები | ზომა ბაიტებში |
| ---------------------- | ---: | ------------------: | ------------: |
| sitemap.xml            |  200 | 5 შვილობილი sitemap |           452 |
| sitemap-pages.xml      |  200 |                  10 |           550 |
| sitemap-categories.xml |  200 |                 580 |        47 802 |
| sitemap-companies.xml  |  200 |               2 911 |       188 434 |
| sitemap-jobs.xml       |  200 |              11 368 |     1 773 657 |

ხუთივე XML სწორად გაიშალა, namespace და აბსოლუტური HTTPS მისამართები სწორია. დამატებითი `sitemap-content.xml`-იც 200-ს აბრუნებს. robots.txt ღიაა ამ ფაილებისთვის. HTTP და www ვერსიები HTTPS ძირითად დომენზე გადადის. ისტორიულ `sitemap-index.xml` მისამართს ახლა ერთსაფეხურიანი 301 აქვს `/sitemap.xml`-ზე.

[Google-ის სახელმძღვანელო](https://support.google.com/webmasters/answer/7451001) `Couldn't fetch`-ის შესაძლო მიზეზებში ასახელებს წვდომის პრობლემას, სანქციას, არასწორ მისამართს და სკანირების დაბალ მოთხოვნას. დღევანდელი მტკიცებულება კონკრეტულ მიზეზს არ ადგენს. ფორმატის ბრმად შეცვლა ან ხშირი ხელახალი გაგზავნა დასაბუთებული გამოსწორება არ არის.

## ჰოსტის მდგომარეობა

[Crawl stats](https://search.google.com/search-console/settings/crawl-stats?resource_id=https%3A%2F%2Fjobx.ge%2F), განახლებული 7 ნოემბერს: 25 460 მოთხოვნა ბოლო 90 დღეზე, საშუალო პასუხი 469 ms. 200 პასუხები 83%-ია, 404 — 12%, 301 — 4%, სხვა 4xx და 5xx — თითოეული 1%-ზე ნაკლები. Host status ბოლო 90 დღეზე საერთო პრობლემას არ აჩვენებს. Manual Actions და Security Issues ორივე სუფთაა. robots.txt-ის დაფიქსირებული ჩამოტვირთვა წარმატებულია.

15 ცალკეული 5xx მოთხოვნის საშუალო ხანგრძლივობა 33 686 ms-ია. ეს პერიოდული სერვერული შეფერხებების საკითხია, მაგრამ ყველა sitemap-ის მიმდინარე სტატუსის მიზეზად არ დასტურდება. 7 ნოემბრის მაგალითი `/companies/jorjian-uoter-end-faueri` ახლა 200-ს აბრუნებს დაახლოებით 1.1 წამში.

შემდგომი მხოლოდ წაკითხვის შემოწმებით Vercel-ის production ლოგებზე წვდომა დადასტურდა. `sitemap` ძიებამ დააბრუნა 50 ჩანაწერი 9 ნოემბრის 05:27:19–09:39:28 UTC შუალედიდან: ყველა HTTP 200, ექვსივე sitemap-ის მისამართზე. ეს ნიმუში არ ადასტურებს ყველა ისტორიული მოთხოვნის წარმატებას და CLI-ის შედეგი Googlebot-ის ვინაობას არ გვიჩვენებს. Firewall overview: custom firewall არ არის კონფიგურირებული, Attack Mode გამორთულია, System Mitigations აქტიურია; ავტომატური დაცვის მიერ ყველა მოთხოვნის დაშვება ამით არ დასტურდება.

ცალკე 5xx ლოგებში `/api/jobs` აბრუნებს 503-ს `public_query_timeout` / `public_load_failed` შეტყობინებებით, ხშირად დაახლოებით 12 წამში. ეს მიმდინარე სერვერული ხარვეზის მტკიცებულებაა, მაგრამ sitemap-ის წაკითხვის შეცდომასთან კავშირი ჯერ არ დადგენილა. შემდეგი ნაბიჯია ამ timeout-ების მიზეზის კვლევა და sitemap-ის ერთი კონტროლირებული ხელახალი გაგზავნის შედეგის შედარება იმავე დროის HTTP და დაცვის ლოგებთან. თუ sitemap წარმატებით ჩამოიტვირთება და დამუშავება ისევ ჩავარდება, Google-ისთვის წერილს უნდა დაემატოს ამ ცდის ზუსტი დრო და შედეგი.

404-ის ნიმუში `/vacancies/sertifitsirebuli-auditori-6b5a3a53-e331-4572-b39e-d9d39a1e0fe4` დღესაც 404-ია. სხვა 4xx-ის მაგალითები ძველ `/mansional/...php` მისამართებზე მოდის; ეს ჩანაწერები თავისთავად მიმდინარე საიტის გატეხვას არ ადასტურებს.

## Indexing API-ის კვოტა და დუბლიკატები

Production ბაზაზე შესრულდა მხოლოდ SELECT მოთხოვნები. კვლევის მომენტში:

- გაგზავნილი შეტყობინებები: 6 383; ბოლო მიღებული — 8 ნოემბერი 10:23:29 UTC.
- მომლოდინე შეტყობინებები: 4 822; მათგან 4 316-ს ჰქონდა `daily-budget`, კიდევ 11-ს — იგივე მიზეზი წინა HTTP 429-ით.
- ბოლო რვა დასრულებულ დღეში დღიური 200 მოთხოვნა სრულად გამოყენებული იყო.
- 2–8 ნოემბერს რიგში ყოველდღე დაემატა შესაბამისად 455, 435, 441, 408, 381, 265 და 201 ჩანაწერი.

[Google-ის მიმდინარე კვოტის დოკუმენტაციით](https://developers.google.com/search/apis/indexing-api/v3/quota-pricing), საწყისი ლიმიტი 200 publish მოთხოვნაა დღეში, განახლებით წყნარი ოკეანის დროით შუაღამეზე. კოდის ლიმიტის თვითნებურად გაზრდა Google-ის ლიმიტს არ ზრდის.

ბოლო ორი დღის გაგზავნილი შეტყობინებებისა და ერთი საკონტროლო URL-ის 399-ჩანაწერიან ნიმუშში 31 გამოქვეყნებული მისამართი მთავარ sitemap-ში არ იყო. ექვსის HTTP შემოწმებამ ექვსივეზე დაადასტურა სხვა canonical. მაგალითად:

- `sauzmis-mzareuli-0e328d06-8968-419b-8679-2f8f2383a4a0` მიუთითებს `sauzmis-mzareuli-e68fdcdd-b0f0-417f-a1c5-bc7dc542f806`-ზე.
- `finansuri-kontroliori-40636bd0-39bb-422b-ac4f-9158bb8ef139` მიუთითებს `finansuri-kontroliori-9699f23c-9e9f-4fdd-ba4a-3eb72c9a16da`-ზე.

ეს კონკრეტული კვოტის დანაკარგია; მთელი რიგის დუბლიკატების წილი არ გაზომილა. სხვა, მთავარი მისამართი `bughalteriis-treneri-9c5df17c-227f-4e39-9ece-78cd2f9e8f68` Google-ს 23 ოქტომბერს წარმატებით ეცნობა, მაგრამ 9 ნოემბრის URL Inspection-ში ჯერ უცნობია. იმავე დღის 12:52:22 live test წარმატებულია და JobPosting ვალიდურია. შესაბამისად, API-ის მიღებული შეტყობინებაც ინდექსაციის გარანტია არ არის.

## ლოკალური შესწორება და შემოწმება

`lib/server/indexing-queue.ts` გაგზავნამდე ამოწმებს საჯარო `searchPlan`-ით მიღებულ canonical-ს, იმავე წევრობისა და რიგითობის წესით, რაც ვაკანსიის გვერდს აქვს. დუბლიკატის შეტყობინება ინიშნება `cancelled / non-canonical`-ად Google API-ისა და დღიური კვოტის გამოყენების გარეშე. საჯარო წყაროს არმქონე ჩანაწერი ასევე აღარ იგზავნება. ხელახლა გამოქვეყნებისას გაუქმებული ჩანაწერის რიგში დაბრუნების არსებული ქცევა შენარჩუნებულია.

შემოწმებები:

- `tests/indexing-queue-integration.test.ts`: 12 წარმატებული ტესტი ლოკალურ `ertad_test` ბაზაში, რეალური მიგრაციებით შექმნილ იზოლირებულ სქემაში. მოწმდება დუბლიკატი, მთავარი URL, გაუქმებული წყარო, ხელახალი ცდა, პარალელური მუშაკები და კონკურენტული რედაქტირება.
- `tests/google-indexing-integration.test.ts`: 2 წარმატებული ტესტი — ატომური კვოტა და publication-ის commit-ის შემდეგ გაგზავნა.
- `tests/google-indexing.test.ts`: 12 წარმატებული ტესტი — ავტორიზაცია, ლიმიტები, წაშლის წინაპირობები და შეცდომები.
- `npm run typecheck`, შეცვლილი TypeScript ფაილების oxlint და oxfmt შემოწმება წარმატებულია.
- ახალი resolver-ის მხოლოდ SELECT შემოწმება production-ზე ორ დუბლიკატს სწორ მთავარ ID-ს უკავშირებს, ხოლო საკონტროლო მთავარ URL-ს უცვლელად ტოვებს.

კოდი ლოკალურია. Commit, push, deploy, production მიგრაცია და რიგის გაშვება არ შესრულებულა. მომხმარებლის თანხმობით მთავარი sitemap ხელახლა გაიგზავნა. ძველი ფორუმის თემის ჩაკეტვის დადასტურების შემდეგ მომხმარებელმა ახალი თემაც დაამტკიცა და ის გამოქვეყნდა.

## ხელახალი გაგზავნა მომხმარებლის თანხმობით

9 ნოემბერს Submit-ზე დაწკაპება დაფიქსირდა 10:15:43 UTC-ზე (14:15:43 თბილისი). 10:16:34 UTC-ზე Search Console-ში დადასტურდა `Sitemap submitted successfully`, ხოლო `/sitemap.xml`-ის Submitted თარიღი შეიცვალა 9 ნოემბრით. 10:17:29 UTC-ზე განახლებული გვერდი ისევ აჩვენებდა `Unknown / Couldn't fetch`, ცარიელ Last read-სა და 0 აღმოჩენილ გვერდს. გაგზავნის მიღება დამუშავების დასრულებას არ ნიშნავს.

`vercel logs --environment production --no-branch --since 2026-11-09T10:07:30Z --query sitemap` შემოწმებამ დადასტურების შემდეგ ახალი ჩანაწერი არ დააბრუნა. ხელმისაწვდომ ლოგებში ამ ცდის შესაბამისი fetch ვერ მოიძებნა; ეს არ ადასტურებს, რომ Google საერთოდ არ დაკავშირებულა ჰოსტთან — ლოგების დაფარვა და დაგვიანებაც გასათვალისწინებელია. ამ ცდისთვის HTTP შეცდომა ან წარმატებული fetch ჯერ არ გვაქვს დასაკავშირებელი.

[არსებული Google-ის თემა](https://support.google.com/webmasters/thread/468733114?hl=en) აჩვენებს `Locked` და `This question is locked and replying has been disabled`. მასში უკვე არის 6 ოქტომბრის განახლებაც, რომელშიც Google-ის ინსპექტორის წარმატებული მოთხოვნა იყო ჰოსტინგის ლოგთან დაკავშირებული. ახალი კომენტარის გამოქვეყნება შეუძლებელია. მომხმარებლის ცალკე თანხმობით შეიქმნა [ახალი თემა](https://support.google.com/webmasters/thread/477037974?hl=en), ძველი განხილვის ბმულით.

## Google-ის ფორუმზე გამოქვეყნებული მიმართვა

### 12 ნოემბრის პასუხები და `is_pending`-ის შემოწმება

ფორუმის Gold Product Expert j0ker-მა მიუთითა, რომ `Couldn't fetch` ზოგადი სტატუსია და ქსელურ პასუხში `is_pending`-ის შემოწმება გვირჩია. მეორე მონაწილემ, Wang Huaimin-მა, შესაძლო მიზეზებად ჰოსტის დატვირთვა და სკანირების დაბალი მოთხოვნა დაასახელა. არც ერთ პასუხში jobx.ge-ს კონკრეტული მიზეზი არ დადასტურებულა.

12 ნოემბრის ავტორიზებულ Search Console-ში ხუთივე sitemap კვლავ `Unknown / Couldn't fetch`-ია, ცარიელი Last read-ითა და 0 აღმოჩენილი გვერდით. მთავარი sitemap-ის Submitted თარიღი 9 ნოემბერია. დეტალის გახსნისას მხოლოდ წასაკითხი ქსელური პასუხი `vyvePb` მივიღეთ HTTP 200-ით; ეს Google-ის ინტერფეისის პასუხია და არა sitemap-ის ჩამოტვირთვის HTTP სტატუსი. მონაცემები რიცხვითი პოზიციებით დაბრუნდა:

```json
[
  "https://jobx.ge/sitemap.xml",
  0,
  1794219344213,
  0,
  null,
  0,
  0,
  null,
  2,
  false,
  null,
  true,
  false
]
```

პასუხში `is_pending` ან `isPending` სახელდებული ველი არ იყო. მასივის ერთ-ერთი `true` მნიშვნელობა მის დადასტურებად არ ჩაგვითვლია, რადგან ველის მნიშვნელობა სანდოდ ვერ დავაკავშირეთ სახელთან. გვერდის დროებითი ქსელური დამკვირვებელი შემოწმების დასრულების შემდეგ მოვხსენით.

[ოფიციალური API-ის აღწერით](https://developers.google.com/webmaster-tools/v1/sitemaps), `isPending: true` ნიშნავს, რომ sitemap დამუშავებული არ არის; თავისთავად შეფერხების მიზეზს არ ადგენს. ოფიციალურ `Sitemaps.get` მოთხოვნაზე ამ სესიიდან ავტორიზებული პასუხი ვერ მივიღეთ: არსებული `gapi.client` OAuth token-ს არ შეიცავდა და ბრაუზერის დამხმარე მოთხოვნამ 404 დააბრუნა; იმავე დოკუმენტირებული მისამართის პირდაპირი, არაავტორიზებული GET პასუხია 401 `UNAUTHENTICATED`. ეს შედეგები jobx.ge-ის sitemap-ის 404-ს ან ბლოკირებას არ ნიშნავს.

ამ საწყისი შემოწმების შემდეგ მომხმარებელმა ცალკე დაამტკიცა Google-ის ოფიციალური OAuth 2.0 Playground-ისთვის მხოლოდ `https://www.googleapis.com/auth/webmasters.readonly` წვდომა. ავტორიზაციის გვერდზეც დადასტურდა მხოლოდ Search Console-ის მონაცემების ნახვის ნებართვა. Google-ის თანხმობის გვერდის მიხედვით, Playground-ის წვდომა 7 დღეში გაუქმდება. ავტორიზაციის კოდი და token-ები ანგარიშში ან პროექტის ფაილებში არ შეგვინახავს.

### 12 ნოემბერს API-ით დადასტურებული შედეგი

მხოლოდ წასაკითხმა [Sitemaps.list](https://developers.google.com/webmaster-tools/v1/sitemaps/list) მოთხოვნამ `https://jobx.ge/` property-ზე HTTP 200 დააბრუნა. პასუხის დროა **2026-11-12 13:56:54 UTC**, ანუ **17:56:54 თბილისი**.

| Sitemap                   | isPending | errors | warnings | lastSubmitted, UTC         |
| ------------------------- | --------- | ------ | -------- | -------------------------- |
| `/sitemap.xml`            | `true`    | `"0"`  | `"0"`    | `2026-11-09T10:15:44.213Z` |
| `/sitemap-jobs.xml`       | `true`    | `"0"`  | `"0"`    | `2026-10-25T16:57:22.472Z` |
| `/sitemap-companies.xml`  | `true`    | `"0"`  | `"0"`    | `2026-10-07T20:01:41.327Z` |
| `/sitemap-categories.xml` | `true`    | `"0"`  | `"0"`    | `2026-10-07T20:01:41.240Z` |
| `/sitemap-pages.xml`      | `true`    | `"0"`  | `"0"`    | `2026-10-07T20:01:41.153Z` |

ხუთივე ჩანაწერში `lastDownloaded`, `type` და `contents` გამოტოვებულია. `isSitemapsIndex` ხუთივეზე `false`-ია, თუმცა მთავარი ფაილის რეალური XML ადრე ინდექსად გადამოწმდა; დაუმუშავებელი ჩანაწერის ამ მნიშვნელობით XML-ის ხარვეზი არ დაგვიდასტურებია.

ახლა `isPending` პირდაპირ სახელდებული ველით დასტურდება. [Google-ის განმარტება](https://developers.google.com/webmaster-tools/v1/sitemaps) მხოლოდ დაუმუშავებელ მდგომარეობას ნიშნავს. ნულოვანი errors/warnings არ არის დასრულებული ვალიდაციის, ხელმისაწვდომობის ყველა შემოწმების წარმატების ან ინდექსაციის გარანტია. API არ გვეუბნება, რატომ რჩება ეს მდგომარეობა. ჰოსტის დატვირთვა და სკანირების დაბალი მოთხოვნა კვლავ დაუდასტურებელი ვარაუდებია.

ამ მოქმედებამ მხოლოდ წაკითხვის ავტორიზაცია და API-ის GET მოთხოვნა მოიცვა. საიტის კოდი, production მონაცემები და sitemap-ის რეგისტრაცია არ შეცვლილა. ფორუმზე დამატებითი პასუხი ამ შემოწმებისას არ გამოქვეყნებულა.

### 9 ნოემბერს გამოქვეყნებული ტექსტი

9 ნოემბერს 10:38:56 UTC-ზე (14:38:56 თბილისი) დადასტურდა გამოქვეყნება: `You have successfully posted in Google Help Community`. ბმულია https://support.google.com/webmasters/thread/477037974?hl=en. სრული ტექსტი ხელახლა წავიკითხეთ და ვიზუალურადაც გადავამოწმეთ. კატეგორიაა Search Console; გამოქვეყნებისას პასუხი ჯერ არ იყო. ქვემოთ გამოქვეყნებული ტექსტია ინგლისურად, როგორც ძველ განხილვაში. ეს საჯარო ფორუმის თემაა და არა Google-ის შიდა საინჟინრო საქმის დადასტურება.

Subject: jobx.ge sitemaps: Couldn't fetch persists since September despite successful Google fetches

Following up on the September 20 report and October 6 update in this now-locked thread:
https://support.google.com/webmasters/thread/468733114?hl=en

On November 9, 2026, the https://jobx.ge/ property still reports Unknown / Couldn't fetch and zero discovered pages for sitemap.xml, sitemap-jobs.xml, sitemap-pages.xml, sitemap-categories.xml and sitemap-companies.xml. The detail view provides no specific HTTP or XML parsing error. The homepage's URL Inspection still shows Discovery > Sitemaps: Temporary processing error.

Evidence collected on November 9, 2026 (Asia/Tbilisi, UTC+4):

- Live tests fetched sitemap.xml successfully at 12:51:10 and sitemap-jobs.xml at 12:54:56, with crawling allowed.
- Historical Googlebot smartphone inspection also records successful fetches: sitemap.xml on October 2 and sitemap-jobs.xml on October 26.
- Public responses are HTTP 200 with valid XML. At the time of the HTTP check, the jobs file contained 11,368 URLs and was 1,773,657 bytes. The index links to five XML child sitemaps.
- The Pages report, updated November 6, has 3,251 indexed pages. Crawl stats report no host problems over the last 90 days. Manual Actions and Security Issues are clear; robots.txt is fetched successfully.
- A controlled resubmission of sitemap.xml was initiated at 14:15:43 and confirmed as successful by 14:16:34. Submitted changed to November 9; at 14:17:29 the report still showed Unknown / Couldn't fetch and a blank Last read. The available hosting request-log query had not yet returned a matching new sitemap request. This is an immediate observation, not proof of a new failed fetch or completed processing attempt.

We understand that Live Tests do not prove sitemap ingestion and that XML sitemap files need not appear as search results. We are asking about the persistent sitemap processing status, not requesting guaranteed URL indexing.

Can the sitemap ingestion status be investigated? If there is a failing fetch or parse, please provide the timestamp, HTTP status or parsing detail so it can be correlated with hosting logs. If this is deferred processing or low crawl demand, please distinguish that from an actual fetch failure.
