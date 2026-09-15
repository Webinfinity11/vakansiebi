# საჯარო გვერდის სტატიკური რესურსები — 2026-09-15

## საბოლოო შედეგი

**რეალური ფონტების გადაცემა: 766,948 → 217,980 ბაიტი (−71.6%).** მთავარ გვერდსა და რეალურ ვაკანსიაზე, სუფთა Chrome-ში, იტვირთება მხოლოდ სამი subset. სრული Regular/SemiBold/Bold-ის მოთხოვნები აღარ არის. შემოწმებულია production build, production-ის ლოკალური ასლით `ertad_perf` და მხოლოდ კითხვის რეჟიმით.

საწყისი და საბოლოო გაზომვები, ყველა რიცხვი ბაიტებში:

| რესურსი | საწყისი raw | საბოლოო raw | საწყისი gzip/HTTP body | საბოლოო gzip/HTTP body |
| --- | ---: | ---: | ---: | ---: |
| რეალურად ჩამოტვირთული ფონტები | 766,948 | 217,980 | 766,948 | 217,980 |
| თანამედროვე Chrome-ის JS (14 ფაილი) | 847,941 | 849,249 | 263,049 | 263,632 |
| HTML-ში ყველა JS, nomodule-ის ჩათვლით (15) | 960,535 | 961,843 | 302,522 | 303,105 |
| CSS (7 ფაილი) | 439,148 | 437,818 | 75,651 | 75,757 |
| HTML `/` | 53,466 | 202,177 | 10,366 | 24,624 |

**შედარების საზღვარი:** გაზომვებს შორის საერთო ხეში სხვა ნაკადებმა შეცვალეს SSR, სიის payload, header და CSS. საწყის HTML-ში რეალური ბარათები არ იყო, საბოლოოში არის. ამიტომ JS/CSS/HTML-ის საერთო სხვაობა მხოლოდ ფონტების სამუშაოს არ მიეწერება. პირველ, ცალკე გაზომილ ფონტების/ინვოისის იმპორტების ეტაპზე JS gzip იყო 263,049 → 263,060; CSS gzip — 75,651 → 75,369. ფონტების ზომის საბოლოო შემცირება პირდაპირ ამ ცვლილებით დასტურდება.

WOFF2 უკვე შეკუმშულია და HTTP gzip დამატებით არ მიიღო. ორი პატარა JS პასუხი (529 და საბოლოოდ 230 ბაიტი) სერვერმა `identity`-ით დააბრუნა; ცხრილში მათი რეალური გადაცემაა ჩათვლილი. თანამედროვე Chrome `nomodule` polyfill-ს არ ითხოვს.

## სრული Regular-ის მიზეზი და შესწორება

მხოლოდ `document.body.innerText` საკმარისი არ აღმოჩნდა: ზოგი საჭირო ნიშანი input-ის `placeholder`-ში ან SVG ტექსტშია. შემოწმდა ორივე გვერდის innerText, ტექსტური DOM nodes, placeholder-ები, `::before`, `::after`, `::marker`, აგრეთვე საწყისი CSS-ის `content` დეკლარაციები.

| დამატებული ნიშანი | Code point | გამოყენება |
| --- | --- | --- |
| № | U+2116 | მთავარი გვერდის რეალური ბარათების მისამართები |
| − | U+2212 | `board.css` / `post-job.css`-ის გახსნილი details-ის content; filter ტექსტი |
| ∞ | U+221E | `app/salary-filter.tsx:86`, ზედა ზღვრის placeholder; ასევე saved-search აღწერა |
| ▸ / ▾ | U+25B8 / U+25BE | disclosure marker-ების დაფარვა |
| ▼ | U+25BC | Base UI SelectIcon-ის SVG-ში არსებული ტექსტი |

გადამწყვეტი დარჩენილი მიზეზი იყო **`placeholder="∞"`**: ის body.innerText-ში არ ჩნდება. დროებითი, მხოლოდ სატესტო ბრაუზერში შესრულებული CSS range-ების შევიწროებით სრული ფონტის მოთხოვნა იზოლირდა `U+221E`-ზე; მეზობელი `U+221C`, `U+221D`, `U+221F` მოთხოვნას არ იწვევდა. ამ ნიშნის subset-ში დამატებისა და სრული face-ის complementary დიაპაზონიდან ამოღების შემდეგ მთავარ გვერდზეც გაქრა სრული Regular-ის ჩამოტვირთვა. საიტის კომპონენტები ან placeholder არ შეცვლილა.

| ფაილი | სრული ორიგინალი | საბოლოო subset |
| --- | ---: | ---: |
| FiraGO-Regular | 250,752 | 71,396 |
| FiraGO-SemiBold | 258,084 | 73,144 |
| FiraGO-Bold | 258,112 | 73,440 |
| ჯამი | 766,948 | 217,980 |

Chrome-ის `encodedBodySize` ორივე შემოწმებულ გვერდზე 217,980 ბაიტია; `transferSize` პასუხების ზედნადებით — 218,880. სამი მოთხოვნაა. 400/600 preload-ები მეორედ არ ჩამოტვირთულა.

### ფონტების მოწყობა

- `scripts/subset-fonts.sh` იყენებს არსებულ `python3 -m fontTools.subset`-ს (fontTools 4.60.2, Brotli), `--layout-features='*'`, `--flavor=woff2`; npm dependency არ დამატებულა.
- თავდაპირველი Georgian/Latin/Cyrillic/punctuation/currency/arrows დიაპაზონები შენარჩუნებულია და ზემოთ ჩამოთვლილი ექვსი დამატებითი code point დაემატა.
- თითო 400/600/700 წონაზე ორი face: subset და სრული ორიგინალი complementary unicode-range-ით. დიაპაზონები არ იკვეთება და ორიგინალის cmap-ის ყველა სიმბოლოს ერთობლივად ფარავს.
- `font-display: swap` დარჩა; 400/600 subset preload-ები არის `app/layout.tsx`-ში, `crossOrigin="anonymous"`-ით. ახალი 500/800 face არ დამატებულა — ისევ 400/700 აირჩევა.
- სრული ორიგინალები დარჩა სხვა დამწერლობებისთვის. იზოლირებულ ნიმუშში `شركة — Ελληνικά`-ის 600 წონით დამატებისას სრულ SemiBold-ზე მოთხოვნა მხოლოდ საჭიროებისას ჩნდება.
- `ctx grep`-მა და `rg`-მა ვერ იპოვა Medium/ExtraBold-ის ან ძველი Georgian TTF-ების გამოყენება. წაიშალა `FiraGO-Medium.woff2` (259,140), `FiraGO-ExtraBold.woff2` (256,848), `georgian-400.ttf` (60,888), `georgian-600.ttf` (60,944), `georgian-800.ttf` (60,876): სულ 698,696 ბაიტი დისკიდან. ეს ფაილები ადრე ქსელში არ იტვირთებოდა, ამიტომ მათი წაშლა ქსელურ ეკონომიაში არ ითვლება. ლიცენზიები დარჩა.

### fallback მეტრიკები და გლიფები

`FiraGO-Regular`: UPM 1000, x-height 527, hhea ascent 935, descent −265, lineGap 0. OS/2 typo მეტრიკები ამავე მნიშვნელობებს უდრის. ადგილობრივი Arial.ttf: UPM 2048, x-height 1062.

```text
size-adjust = (527 / 1000) / (1062 / 2048) = 101.6286%
ascent-override = (935 / 1000) / 1.016286... = 92.0016%
descent-override = (265 / 1000) / 1.016286... = 26.0753%
line-gap-override = 0%
```

სკრიპტი ამ რიცხვებს ბეჭდავს და სხვა სისტემისთვის იღებს `ARIAL_FONT=/path/to/Arial.ttf`-ს. თუ Arial ლოკალურად მიუწვდომელია, სტეკის შემდეგი სისტემური ფონტი გამოიყენება; fallback-ის გათანაბრება ყველა ოპერაციულ სისტემაზე ნულოვან CLS-ს არ ნიშნავს.

სამივე subset-ზე fontTools-ით გადამოწმდა: ორიგინალიდან მოთხოვნილ დიაპაზონებში არსებული **729 cmap სიმბოლო** შენარჩუნდა (ექვსი დამატებითი ნიშნით საბოლოო cmap დაფარვა 735-ია), `case`-ის **68 Unicode-დან მიღებული ჩანაცვლების** კონტური და advance width იდენტურია; `case`, `kern`, `liga` ტეგები დარჩა. მოთხოვნილი `U+1C90–1CBF` დიაპაზონი ჩართულია, თუმცა თვით ამ FiraGO ორიგინალს პირდაპირი U+1C90 cmap ჩანაწერი არ აქვს: არსებულ ქართულ სათაურებს მთავრულად ისევ `case` feature გარდაქმნის.


დამატებული ექვსი გლიფი, `case`/`liga`/`kern` და სრული/subset დიაპაზონების არგადაკვეთა fontTools-ით გადამოწმებულია. ახალი ანიმაცია ან მობილური CSS წესი არ დამატებულა; `prefers-reduced-motion` უცვლელია. პირველ იზოლირებულ გაზომვაში ადრეული ფონტთან თანხვედრილი CLS იყო 0.0001684 → 0.0000024; საბოლოო ერთიანი ხის CLS-ის ცვლილების ატრიბუცია ამ ფონტების ანგარიშის ფარგლებს სცდება.

## CSS

`invoices.css` და `invoices-print.css` იმპორტები გადავიდა `app/invoices/[token]/page.tsx`-ში; მთავარი layout-დან ამოღებულია. საწყისი webpack stats ადასტურებდა ინვოისის ცალკე CSS chunk-ს და მთავარ HTML-ში მის არყოფნას. `post-job.css` დარჩა. ინვოისის რეალური ბეჭდვა ამ ნაკადში არ შემოწმებულა.

დანარჩენი CSS ამ ნაკადს არ შეუცვლია. მიმდინარე საწყისი ფაილების raw/gzip ზომები (Python gzip level 6; განსხვავდება production-ის გაერთიანებული minified chunk-ებისგან):

| CSS | raw | gzip |
| --- | ---: | ---: |
| `app/board-features.css` | 12,526 | 2,880 |
| `app/search-features.css` | 3,531 | 1,122 |
| `app/post-job.css` | 8,598 | 2,338 |
| `app/invoices-print.css` | 254 | 151 |
| `app/theme-dark.css` | 74,434 | 10,158 |
| `app/refined-board.css` | 29,640 | 5,575 |
| `app/invoices.css` | 3,653 | 1,045 |
| `app/public-header.css` | 4,502 | 949 |
| `app/personal-space.css` | 2,444 | 930 |
| `app/globals.css` | 67,482 | 13,409 |
| `app/board.css` | 89,421 | 16,154 |
| `app/phone.css` | 26,531 | 6,619 |

`theme-dark.css` შეკუმშვის შემდეგ შედარებით მცირეა; ამ ნაკადს მისი ჩატვირთვის სქემა არ შეუცვლია. Tailwind-ის გენერირებული წესებით globals chunk დაახლოებით 239KB raw-ია; მისი არა-ფონტური გაწმენდა სხვა ფარგლებს მოითხოვს.

## JS ანალიზი და დიაგნოსტიკის გაწმენდა

ანალიზისას, ადგილობრივი Next სახელმძღვანელოების მიხედვით, დროებით გამოყენებული იყო webpack `compiler.hooks.done` და `stats.toJson` (`assets`, `chunks`, `chunkModules`, `modules`, `nestedModules`, `dependentModules`, `reasons`). შედეგიდან შეირჩა მხოლოდ `/` HTML-ში მითითებული chunk-ები. Source size ქვემოთ მინიფიცირებულ ან gzip ქსელურ ზომას არ უდრის.

**გამოშვების კონფიგურაციიდან დიაგნოსტიკა სრულად ამოღებულია:** `ANALYZE`, `ClientAssetStats`, webpack override, `node:fs` და `node:path` იმპორტები აღარ არის. `next.config.ts`-ში სხვისი `/invoices` headers ბლოკი უცვლელად დარჩა. ჩვეულებრივი `npm run build` აღარ წერს დამატებით stats-ს.

თავდაპირველი აუდიტის შედეგი:

| მოდული / ჯგუფი | webpack source ბაიტი | საჯარო ბანდლში მოხვედრის მიზეზი |
| --- | ---: | --- |
| React DOM client | 616,647 | React UI runtime |
| `@base-ui` (154 მოდული) | 495,923 | job-board → Checkbox/Select/Sheet; personal-space → Sheet/Dialog |
| `zod` | 348,221 | `lib/personal-space.ts`-ის localStorage მონაცემების schema/parse |
| Next segment-cache/cache | 145,196 | Next router runtime |
| `app/job-board.tsx` | 119,239 | მთავარი client კომპონენტი |
| `tailwind-merge` | 105,606 | `components/ui/*` → `lib/utils.ts` → `cn()` |
| Next segment-cache/scheduler | 95,827 | Next router runtime |
| `@floating-ui` (5 მოდული) | 85,678 | Base UI popup/focus/positioning |
| `app/personal-space.tsx` | 47,237 | `job-board.tsx`-ის სტატიკური `usePersonalSpace` იმპორტი |
| `lucide-react` (49 მოდული) | 41,245 | გამოყენებული UI ხატულები |
| `recharts` | 0 | ამ საჯარო chunk-ებში არ არის |
| `embla` | 0 | ამ საჯარო chunk-ებში არ არის |

უსაფუძვლოდ მოხვედრილი Recharts/Embla არ დადასტურდა. Base UI არსებული რეალური კონტროლებისთვის გამოიყენება, ამიტომ მისი მოცილება კომპონენტების შეცვლას მოითხოვდა. სხვა ნაკადისთვის შემდგომი გამოკვლევის კონკრეტული ადგილია `app/job-board.tsx:98` → `app/personal-space.tsx` → `lib/personal-space.ts`: `usePersonalSpace` იმპორტს ახლავს პერსონალური პანელებისა და Zod-ის კოდი. უნდა შეფასდეს hook-ის/პანელის განცალკევება და საჭიროებისას ჩატვირთვა არსებული ქცევების შენარჩუნებით. ამ ნაკადს ეს ფაილები არ შეუცვლია.


დროებითი ანალიზის გამეორებისას plugin უნდა დაემატოს მხოლოდ იზოლირებულ სამუშაო ასლში; გამოსაშვებ კონფიგურაციაში მისი დატოვება საჭირო არ არის. შენახული თავდაპირველი stats არის `/tmp/perf-assets-2026-09-15/client-stats-after.json`-ში. არც დიაგნოსტიკური JS/Python სკრიპტი და არც ლოგი ამ ნაკადს project tree-ში არ დაუტოვებია; ყველა ასეთი არტეფაქტი `/tmp/perf-assets-2026-09-15/`-შია. `subset-fonts.sh` განზრახ დარჩენილი, ხელახლა გენერირების მუდმივი ხელსაწყოა.

## მეთოდი და საბოლოო HTTP ფაილები

Next 16.3.4 / React 19.2.6, webpack. წაკითხულია `node_modules/next/dist/docs/`-ის CSS/fonts/package-bundling/webpack დოკუმენტაცია. build output `/`-ს აჩვენებს როგორც `ƒ`; ამ ვერსიაში `First Load JS` სვეტი არ იბეჭდება, ამიტომ ზომები HTML-ის რეალური URL-ებით დათვლილია.

`npm run build`-ის შემდეგ სერვერი გაეშვა ასე:

```sh
DATABASE_URL=postgresql://ertad@127.0.0.1:55432/ertad_perf PGOPTIONS='-c default_transaction_read_only=on' PORT=3103 npm start
```

სათითაოდ შედარდა `curl -H 'Accept-Encoding: identity'` და `curl -H 'Accept-Encoding: gzip'` body-ები/Content-Encoding. `next start` არსებულ standalone კონფიგურაციაზე გაფრთხილებას ბეჭდავს, თუმცა რესურსები წარმატებით გასცა. Chrome-ის ცივი context: 1365×1000; დაელოდა network idle-ს და `document.fonts.ready`-ს. საბოლოო კონკრეტული ვაკანსია: `/vacancies/ca125f63-eaff-41e5-8c36-c332e76b42a0`, Fabrica Trading Co Limited.

| საბოლოო URL | raw | gzip/HTTP body |
| --- | ---: | ---: |
| `/` | 202,177 | 24,624 |
| `/_next/static/css/b326275469bac800.css` | 239,414 | 38,808 |
| `/_next/static/css/886f6cd6f459aecb.css` | 71,512 | 13,639 |
| `/_next/static/css/d90fb6ae896c1e7a.css` | 15,713 | 3,649 |
| `/_next/static/css/faf0b7e9923eb145.css` | 9,560 | 2,213 |
| `/_next/static/css/ab1a38afca6fd22e.css` | 34,613 | 6,688 |
| `/_next/static/css/5e1c8182151b79f0.css` | 62,638 | 9,455 |
| `/_next/static/css/4a933855d7f53eef.css` | 4,368 | 1,305 |
| `/_next/static/chunks/webpack-807a9de218fdd8a8.js` | 3,428 | 1,736 |
| `/_next/static/chunks/4bd1b696-8a4ab4fdf0ae305a.js` | 201,060 | 63,375 |
| `/_next/static/chunks/3794-a6cbe3f16d804637.js` | 241,388 | 65,692 |
| `/_next/static/chunks/main-app-d6862b5144b4beea.js` | 529 | 529 |
| `/_next/static/chunks/8500-01a63dafd809e317.js` | 8,665 | 3,552 |
| `/_next/static/chunks/5232-0d71bfb93e0cb0ed.js` | 15,775 | 6,092 |
| `/_next/static/chunks/1754-5a88c5902254a3f3.js` | 13,307 | 4,670 |
| `/_next/static/chunks/app/not-found-70cac65a0a25161f.js` | 2,179 | 1,024 |
| `/_next/static/chunks/665-121aed7bd0831b67.js` | 89,941 | 25,565 |
| `/_next/static/chunks/8875-7f43cfe03f5743c9.js` | 96,997 | 32,057 |
| `/_next/static/chunks/5099-b805a0c25cedb122.js` | 87,095 | 31,872 |
| `/_next/static/chunks/1592-4a8b5b293308a93d.js` | 31,289 | 10,422 |
| `/_next/static/chunks/9746-f0ee7defa1562817.js` | 57,366 | 16,816 |
| `/_next/static/chunks/app/page-10956859e02ab07a.js` | 230 | 230 |
| `/_next/static/chunks/polyfills-42372ed130431b0a.js` | 112,594 | 39,473 |

## საბოლოო შემოწმებები

| შემოწმება | შედეგი |
| --- | --- |
| `npm run build` | წარმატებული; გაშვებამდე სხვა build და `.next/lock` არ იყო |
| `npm run typecheck` | წარმატებული |
| `npm run lint` | წარმატებული |
| `env -u RUN_DB_TESTS npm test` | 265 ტესტი: 246 pass, 19 skip, 0 fail |
| fontTools cmap/features/ranges | დამატებითი სიმბოლოები და case/kern/liga შენარჩუნებულია; სრული/subset დიაპაზონები არ იკვეთება |
| მთავარი, რეალური ბარათები | ქართული, მთავრული, ლათინური კომპანია, ₾ სწორად ჩანს; სრული font მოთხოვნა 0 |
| რეალური ვაკანსია | ქართული სათაური და ინგლისური აღწერა სწორად ჩანს; სრული font მოთხოვნა 0 |
| ღია/მუქი თემა ორივე გვერდზე | screenshots დათვალიერებულია |
| Cyrillic / Arabic / Greek | იზოლირებული ფონტის ნიმუში შემოწმებულია; სხვა დამწერლობის სრული face საჭიროებისამებრ ხელმისაწვდომია |
| საწყისად დაბლოკილი ბოლო build | მოგვარებულია: საბოლოო ჩვეულებრივი build წარმატებით დასრულდა |

Network JSON/screenshot-ები: `release-final.json`, `release-home-final*.png`, `release-vacancy-final*.png`; ბრძანებების logs: `release-*-final.log`, ყველა `/tmp/perf-assets-2026-09-15/`-ში. საწყისი ამდე/შემდეგ არტეფაქტებიც ცალკე შენარჩუნებულია. განსხვავებული ტესტების რაოდენობა წინა ანგარიშთან შედარებით საერთო ხეში სხვა ნაკადების დამატებული ტესტებიდან მოდის.

## გამოშვებისთვის გადასაცემი სია

- **შეცვლილი:** `app/globals.css` (მხოლოდ ფონტები), `app/layout.tsx`, `app/invoices/[token]/page.tsx` (ორი CSS იმპორტი), `scripts/subset-fonts.sh`, `docs/perf-assets-2026-09-15.md`. `next.config.ts` დიაგნოსტიკისგან გაიწმინდა; მის საბოლოო git diff-ში მხოლოდ სხვა ნაკადის invoices headers რჩება.
- **შექმნილი:** `public/fonts/FiraGO-Regular-subset.woff2`, `public/fonts/FiraGO-SemiBold-subset.woff2`, `public/fonts/FiraGO-Bold-subset.woff2`; `scripts/subset-fonts.sh` და ეს ანგარიში ამ სამუშაოს ფარგლებში ახალი ფაილებია.
- **წაშლილი:** `public/fonts/georgian-400.ttf`, `georgian-600.ttf`, `georgian-800.ttf`, `FiraGO-Medium.woff2`, `FiraGO-ExtraBold.woff2`.
- **საჭირო DB მიგრაციები ამ ცვლილებისთვის:** არცერთი. `ertad_perf` გამოყენებულია მხოლოდ წასაკითხად; production ბაზაზე ჩაწერა არ შესრულებულა. სხვა ნაკადების 018/019 ამ ფონტების სამუშაოს ნაწილი არ არის.
- **მუდმივი env ცვლილებები:** არცერთი. DATABASE_URL/PGOPTIONS/PORT ზემოთ მხოლოდ ლოკალური QA პროცესისთვისაა; `.env` ფაილები უცვლელია.
- **production-ზე დამატებით გასაშვები სკრიპტები:** არცერთი. subset ფაილები უკვე გენერირებულია და ჩვეულებრივ build/artifact-ს მიჰყვება. `scripts/subset-fonts.sh` საჭიროა მხოლოდ მომავალში ფონტის ხელახლა გენერირებისთვის, build/deploy-ის წინ; production სერვერზე fontTools საჭირო არ არის.

ამ ნაკადს commit, staging, push ან deploy არ გაუკეთებია. ანგარიშის ფარგლებია მხოლოდ ზემოთ ჩამოთვლილი საკუთარი ცვლილებები; სხვა ნაკადების დროებითი/უცნობი ფაილები არ წაშლილა.

## ლაივის HTTP ჰედერების დამატებითი შემოწმება

2026-09-15, 09:08 UTC: `curl -sI https://jobx.ge/` და `curl -sI https://jobx.ge/api/health` ორივეგან HTTP/2 200.

| ჰედერი | `/` | `/api/health` |
| --- | --- | --- |
| Strict-Transport-Security | `max-age=63072000` | `max-age=63072000` |
| X-Frame-Options | `DENY` | `DENY` |
| Referrer-Policy | `strict-origin-when-cross-origin` | `strict-origin-when-cross-origin` |
| Server | `Vercel` | `Vercel` |
| Permissions-Policy | არ არის | არ არის |

აპლიკაციის მიმდინარე ჰედერის კონფიგურაციაში HSTS არ არის, ხოლო ორივე ლაივ პასუხში უკვე არის; შესაბამისად პლატფორმიდან მიწოდება დასტურდება არსებული კონფიგურაციისა და პასუხების შედარებით. კოდში მისი დამატება საჭირო არ არის.

სხვა ნაკადის შემოთავაზებაა `Permissions-Policy: camera=(), microphone=(), geolocation=(self), payment=()`. `app/job-board.tsx` იყენებს geolocation-ს. უსაფრთხოების ახალი policy თავდაპირველ ფონტების/bundle ამოცანაში არ შედიოდა; `how-this-thread-works`-ის ფარგლების წესის გამო კოდში ცვლილება არ შეტანილა და მომხმარებლის დაზუსტებას ელოდება. CSP არ დამატებულა. ეს განახლება მხოლოდ ანგარიშს ეხება, ამიტომ build/typecheck/lint ხელახლა არ გაშვებულა.
