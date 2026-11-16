# R3 — სინთეზური CV-ების პარსერის შეფასება

სტატუსი: **verified by tests only**. მოქმედ აპში ატვირთვა/შენახვა/ფილტრაცია **not done** — ამ დავალების ფარგლებია მხოლოდ `extractCvText` → `parseCvText`; პარსერის შესწორება აკრძალული იყო. ყველა ადამიანი, ორგანიზაცია და კონტაქტი გამოგონილია. ბაზა, სერვერი, deployment და git მდგომარეობა არ შეცვლილა.

## მეთოდი და შეზღუდვები

- 12 ფაილი: 8 PDF, TXT, DOCX, RTF, ODT. PDF-ები სინთეზური განლაგებების რეპლიკებია და არა ოფიციალური Europass/LinkedIn/hh ექსპორტის ზუსტი ასლები.
- თარიღი ფიქსირდება `2026-11-16T12:00:00Z`-ზე Node MockTimers-ით. თვეების გაერთიანება ითვლება გადაფარვის გარეშე, ორივე ბოლო თვის ჩათვლით, შემდეგ floor(months/12). მხოლოდ წლებისას იანვარი–დეკემბერი შეფასების დაშვებაა და არა ზუსტი რეალური სტაჟი.
- LinkedIn-ის „5 years 11 months“ და hh-ის „6 лет 3 месяца“ შეგნებულად ძველი შეჯამებებია. Ground truth ითვლება რეალური დიაპაზონებიდან ფიქსირებულ თარიღამდე.
- ერთი ქულა = ერთი სრული ველის ჯგუფი ერთ CV-ში. მასივებში რიგი არ ფასდება, ზედმეტი/დაკარგული წევრი ან არასწორი დონე MISS-ია. ეს არის მკაცრი შესაბამისობის დიაგნოსტიკა და არა რეალურ კანდიდატებზე პარსერის საერთო სიზუსტის პროცენტი. როლების სორტირების ხარისხი ცალკე არ შეფასებულა.
- სახელი/email/phone/roleDates/certifications ხუთი ჯგუფი სქემაში არ არსებობს: 60 MISS დიზაინის შესაძლებლობის შეზღუდვაა. Candidate-ში კონტაქტები არსებობს, მაგრამ ტესტირებული Profile API-ში არა. ტექსტში მათი არსებობა `results.json`-ში ცალკეა.
- AcadNusx PDF მოდელირებს ლათინურ სიმბოლოებად ამოღებულ ტექსტს; ნამდვილი legacy შრიფტის ვიზუალური გლიფები/encoding არ გამოიყენება. TXT-ის პირდაპირი `parseCvText` დიაგნოსტიკაც `results.json`-შია, მაგრამ TXT-ის ამომღების 0 შედეგს არ ცვლის.
- FiraGO გამოიყენება არსებული ტესტიდან. PDF-ში სტრიქონი NFC-ზე ნორმალიზდება, რომ დაშლილი რუსული й-ის accent subset-font-მა არ დაკარგოს; ეს არ ამოწმებს რეალური decomposed-font PDF-ების ყველა შემთხვევას.
- CEFR grid-ში ყველა კომპონენტი B2-ია: არათანაბარი კომპეტენციების სცენარი ამ ნაკრებით არ შემოწმებულა. Full Professional შენარჩუნებულია ground truth-ში როგორც საწყისი დასახელება; CEFR-ის გამოგონილი ეკვივალენტი არ გამოგვიყენებია.
- DOCX-ის სახელი header-შია, გამოცდილება date | role ცხრილში. ტექსტბოქსის ცალკე სცენარი არ არის. PDF სკანი ნამდვილი გამოსახულებაა და ტექსტური ფენა არ აქვს.

## შედეგები

**25/144** სრული ველის ჯგუფი სწორია. მხოლოდ მოდელის არსებული 7 ჯგუფის მიხედვით: **25/84**; მათგან არაცარიელი ტექსტის მქონე 8 ფაილზე **25/56**. სახელი ტექსტში ზუსტად 6/12 ფაილშია, email/phone — 8/12-ში. ეს რიცხვები სტრუქტურირებული კონტაქტების წარმატებად არ ითვლება.

| ველი | სწორი | მოსალოდნელი |
|---|---:|---:|
| name | 0 | 12 |
| email | 0 | 12 |
| phone | 0 | 12 |
| city | 6 | 12 |
| roles | 1 | 12 |
| years | 2 | 12 |
| education | 4 | 12 |
| educationLevel | 4 | 12 |
| skills | 3 | 12 |
| languages | 5 | 12 |
| certifications | 0 | 12 |
| roleDates | 0 | 12 |

## თითოეული ნიმუში და თითოეული აცდენის მიზეზი

### europass-en.pdf

ამოღებულია 471 სიმბოლო; დრო 1100.37 ms (ამოღება 1054.86, პარსინგი 45.51). ზუსტად სწორი ველები: city.

ტექსტში სახელი/email/phone: {"name": true, "email": true, "phone": true}.

- `name` — სტრუქტურირებული ველი არ არსებობს: `lib/company-candidates.ts:46` და `lib/cv-parse.ts:291`. ტექსტში შენარჩუნება ცალკე დიაგნოსტიკაა; ეს არ ამტკიცებს კანდიდატის ატვირთვის მთლიანი პროცესის გაუმართაობას.
- `email` — სტრუქტურირებული ველი არ არსებობს: `lib/company-candidates.ts:46` და `lib/cv-parse.ts:291`. ტექსტში შენარჩუნება ცალკე დიაგნოსტიკაა; ეს არ ამტკიცებს კანდიდატის ატვირთვის მთლიანი პროცესის გაუმართაობას.
- `phone` — სტრუქტურირებული ველი არ არსებობს: `lib/company-candidates.ts:46` და `lib/cv-parse.ts:291`. ტექსტში შენარჩუნება ცალკე დიაგნოსტიკაა; ეს არ ამტკიცებს კანდიდატის ატვირთვის მთლიანი პროცესის გაუმართაობას.
- `roles` — dd/mm/yyyy სრულად არ იკითხება (`lib/cv-parse.ts:145`); ნაწილობრივი თარიღის შემდეგ დარჩენილი `01/` როლად ხდება (`:249`, `:251`, `:254`).
- `years` — dd/mm/yyyy ტოკენი არ არსებობს (`lib/cv-parse.ts:145`); პირველი პერიოდი ნაწილობრივ იკითხება, მეორე ვერ ერთიანდება. შედეგი 4 ნაცვლად 7 წლისა (`:207`, `:292`).
- `education` — სექციის სათაური ზუსტად უნდა ემთხვეოდეს ჩამონათვალს (`lib/cv-parse.ts:185`, `:189`, `:191`, `:195`); ამ ნიმუშის სათაური არ ემთხვევა.
- `educationLevel` — სექციის სათაური ზუსტად უნდა ემთხვეოდეს ჩამონათვალს (`lib/cv-parse.ts:185`, `:189`, `:191`, `:195`); ამ ნიმუშის სათაური არ ემთხვევა. დონე მხოლოდ ამ სექციიდან ითვლება (`lib/cv-parse.ts:299`).
- `skills` — სექციის სათაური ზუსტად უნდა ემთხვეოდეს ჩამონათვალს (`lib/cv-parse.ts:185`, `:189`, `:191`, `:195`); ამ ნიმუშის სათაური არ ემთხვევა. `DIGITAL SKILLS` ვერ იკითხება; მთელ ტექსტში ცნობილი Excel/SQL მაინც იძებნება, Data visualization იკარგება (`lib/cv-parse.ts:277`, `:283`).
- `languages` — `Mother tongue(s): Georgian`-ში დონე სახელამდეა; კოდი მხოლოდ სახელის შემდგომ მონაკვეთს ამოწმებს (`lib/cv-parse.ts:242`). English B2 სწორია; მრავალკომპონენტიან CEFR grid-ს მოდელი ცალკე ველებად არ ინახავს (`lib/company-candidates.ts:55`).
- `certifications` — სტრუქტურირებული ველი არ არსებობს: `lib/company-candidates.ts:46` და `lib/cv-parse.ts:291`. ტექსტში შენარჩუნება ცალკე დიაგნოსტიკაა; ეს არ ამტკიცებს კანდიდატის ატვირთვის მთლიანი პროცესის გაუმართაობას.
- `roleDates` — სტრუქტურირებული ველი არ არსებობს: `lib/company-candidates.ts:46` და `lib/cv-parse.ts:291`. ტექსტში შენარჩუნება ცალკე დიაგნოსტიკაა; ეს არ ამტკიცებს კანდიდატის ატვირთვის მთლიანი პროცესის გაუმართაობას.

### linkedin-export.pdf

ამოღებულია 372 სიმბოლო; დრო 21.78 ms (ამოღება 12.42, პარსინგი 9.36). ზუსტად სწორი ველები: city.

ტექსტში სახელი/email/phone: {"name": true, "email": true, "phone": true}.

- `name` — სტრუქტურირებული ველი არ არსებობს: `lib/company-candidates.ts:46` და `lib/cv-parse.ts:291`. ტექსტში შენარჩუნება ცალკე დიაგნოსტიკაა; ეს არ ამტკიცებს კანდიდატის ატვირთვის მთლიანი პროცესის გაუმართაობას.
- `email` — სტრუქტურირებული ველი არ არსებობს: `lib/company-candidates.ts:46` და `lib/cv-parse.ts:291`. ტექსტში შენარჩუნება ცალკე დიაგნოსტიკაა; ეს არ ამტკიცებს კანდიდატის ატვირთვის მთლიანი პროცესის გაუმართაობას.
- `phone` — სტრუქტურირებული ველი არ არსებობს: `lib/company-candidates.ts:46` და `lib/cv-parse.ts:291`. ტექსტში შენარჩუნება ცალკე დიაგნოსტიკაა; ეს არ ამტკიცებს კანდიდატის ატვირთვის მთლიანი პროცესის გაუმართაობას.
- `roles` — გვერდი შუაზე, 49%/51%-ით იყოფა და მარჯვენა ჯგუფში >4 ელემენტს მოითხოვს (`lib/server/cv-text.ts:125`). 30%-იანი მარცხენა სვეტისას მარჯვენა ტექსტი ამ ზღვარს კვეთს; რიგები ერთიანდება: `Tbilisi Experience`, `Tableau Education` (`:140`, `:160`). შედეგად სექციებიც ვეღარ ამოიცნობა (`lib/cv-parse.ts:185`).
- `years` — გვერდი შუაზე, 49%/51%-ით იყოფა და მარჯვენა ჯგუფში >4 ელემენტს მოითხოვს (`lib/server/cv-text.ts:125`). 30%-იანი მარცხენა სვეტისას მარჯვენა ტექსტი ამ ზღვარს კვეთს; რიგები ერთიანდება: `Tbilisi Experience`, `Tableau Education` (`:140`, `:160`). შედეგად სექციებიც ვეღარ ამოიცნობა (`lib/cv-parse.ts:185`).
- `education` — გვერდი შუაზე, 49%/51%-ით იყოფა და მარჯვენა ჯგუფში >4 ელემენტს მოითხოვს (`lib/server/cv-text.ts:125`). 30%-იანი მარცხენა სვეტისას მარჯვენა ტექსტი ამ ზღვარს კვეთს; რიგები ერთიანდება: `Tbilisi Experience`, `Tableau Education` (`:140`, `:160`). შედეგად სექციებიც ვეღარ ამოიცნობა (`lib/cv-parse.ts:185`).
- `educationLevel` — გვერდი შუაზე, 49%/51%-ით იყოფა და მარჯვენა ჯგუფში >4 ელემენტს მოითხოვს (`lib/server/cv-text.ts:125`). 30%-იანი მარცხენა სვეტისას მარჯვენა ტექსტი ამ ზღვარს კვეთს; რიგები ერთიანდება: `Tbilisi Experience`, `Tableau Education` (`:140`, `:160`). შედეგად სექციებიც ვეღარ ამოიცნობა (`lib/cv-parse.ts:185`).
- `skills` — გვერდი შუაზე, 49%/51%-ით იყოფა და მარჯვენა ჯგუფში >4 ელემენტს მოითხოვს (`lib/server/cv-text.ts:125`). 30%-იანი მარცხენა სვეტისას მარჯვენა ტექსტი ამ ზღვარს კვეთს; რიგები ერთიანდება: `Tbilisi Experience`, `Tableau Education` (`:140`, `:160`). შედეგად სექციებიც ვეღარ ამოიცნობა (`lib/cv-parse.ts:185`). `Top Skills`-იც არ არის მხარდაჭერილ სათაურებში (`lib/cv-parse.ts:191`); მხოლოდ SQL ამოიცნობა საერთო ლექსიკონით (`:283`).
- `languages` — Full Professional არ არის დონეების ლექსიკონში (`lib/cv-parse.ts:79`), არც raw-level ველი არსებობს (`lib/company-candidates.ts:55`). null CEFR-ის უსაფრთხო არჩევანია, მაგრამ ორიგინალი კვალიფიკაცია სტრუქტურულად იკარგება; მისთვის თვითნებურად CEFR არ მიგვინიჭებია.
- `certifications` — სტრუქტურირებული ველი არ არსებობს: `lib/company-candidates.ts:46` და `lib/cv-parse.ts:291`. ტექსტში შენარჩუნება ცალკე დიაგნოსტიკაა; ეს არ ამტკიცებს კანდიდატის ატვირთვის მთლიანი პროცესის გაუმართაობას.
- `roleDates` — სტრუქტურირებული ველი არ არსებობს: `lib/company-candidates.ts:46` და `lib/cv-parse.ts:291`. ტექსტში შენარჩუნება ცალკე დიაგნოსტიკაა; ეს არ ამტკიცებს კანდიდატის ატვირთვის მთლიანი პროცესის გაუმართაობას.

### two-column-canva.pdf

ამოღებულია 312 სიმბოლო; დრო 8.6 ms (ამოღება 7.78, პარსინგი 0.83). ზუსტად სწორი ველები: city, languages.

ტექსტში სახელი/email/phone: {"name": true, "email": true, "phone": true}.

- `name` — სტრუქტურირებული ველი არ არსებობს: `lib/company-candidates.ts:46` და `lib/cv-parse.ts:291`. ტექსტში შენარჩუნება ცალკე დიაგნოსტიკაა; ეს არ ამტკიცებს კანდიდატის ატვირთვის მთლიანი პროცესის გაუმართაობას.
- `email` — სტრუქტურირებული ველი არ არსებობს: `lib/company-candidates.ts:46` და `lib/cv-parse.ts:291`. ტექსტში შენარჩუნება ცალკე დიაგნოსტიკაა; ეს არ ამტკიცებს კანდიდატის ატვირთვის მთლიანი პროცესის გაუმართაობას.
- `phone` — სტრუქტურირებული ველი არ არსებობს: `lib/company-candidates.ts:46` და `lib/cv-parse.ts:291`. ტექსტში შენარჩუნება ცალკე დიაგნოსტიკაა; ეს არ ამტკიცებს კანდიდატის ატვირთვის მთლიანი პროცესის გაუმართაობას.
- `roles` — სექციის სათაური ზუსტად უნდა ემთხვეოდეს ჩამონათვალს (`lib/cv-parse.ts:185`, `:189`, `:191`, `:195`); ამ ნიმუშის სათაური არ ემთხვევა.
- `years` — სექციის სათაური ზუსტად უნდა ემთხვეოდეს ჩამონათვალს (`lib/cv-parse.ts:185`, `:189`, `:191`, `:195`); ამ ნიმუშის სათაური არ ემთხვევა.
- `education` — სექციის სათაური ზუსტად უნდა ემთხვეოდეს ჩამონათვალს (`lib/cv-parse.ts:185`, `:189`, `:191`, `:195`); ამ ნიმუშის სათაური არ ემთხვევა.
- `educationLevel` — სექციის სათაური ზუსტად უნდა ემთხვეოდეს ჩამონათვალს (`lib/cv-parse.ts:185`, `:189`, `:191`, `:195`); ამ ნიმუშის სათაური არ ემთხვევა.
- `skills` — სექციის სათაური ზუსტად უნდა ემთხვეოდეს ჩამონათვალს (`lib/cv-parse.ts:185`, `:189`, `:191`, `:195`); ამ ნიმუშის სათაური არ ემთხვევა. `S K I L L S` ვერ იკითხება; Figma/Photoshop საერთო ლექსიკონიდან გადარჩა, Typography არა (`lib/cv-parse.ts:283`).
- `certifications` — სტრუქტურირებული ველი არ არსებობს: `lib/company-candidates.ts:46` და `lib/cv-parse.ts:291`. ტექსტში შენარჩუნება ცალკე დიაგნოსტიკაა; ეს არ ამტკიცებს კანდიდატის ატვირთვის მთლიანი პროცესის გაუმართაობას.
- `roleDates` — სტრუქტურირებული ველი არ არსებობს: `lib/company-candidates.ts:46` და `lib/cv-parse.ts:291`. ტექსტში შენარჩუნება ცალკე დიაგნოსტიკაა; ეს არ ამტკიცებს კანდიდატის ატვირთვის მთლიანი პროცესის გაუმართაობას.

### us-resume.pdf

ამოღებულია 392 სიმბოლო; დრო 28.53 ms (ამოღება 6.96, პარსინგი 21.57). ზუსტად სწორი ველები: roles, years, education, educationLevel, skills, languages.

ტექსტში სახელი/email/phone: {"name": true, "email": true, "phone": true}.

- `name` — სტრუქტურირებული ველი არ არსებობს: `lib/company-candidates.ts:46` და `lib/cv-parse.ts:291`. ტექსტში შენარჩუნება ცალკე დიაგნოსტიკაა; ეს არ ამტკიცებს კანდიდატის ატვირთვის მთლიანი პროცესის გაუმართაობას.
- `email` — სტრუქტურირებული ველი არ არსებობს: `lib/company-candidates.ts:46` და `lib/cv-parse.ts:291`. ტექსტში შენარჩუნება ცალკე დიაგნოსტიკაა; ეს არ ამტკიცებს კანდიდატის ატვირთვის მთლიანი პროცესის გაუმართაობას.
- `phone` — სტრუქტურირებული ველი არ არსებობს: `lib/company-candidates.ts:46` და `lib/cv-parse.ts:291`. ტექსტში შენარჩუნება ცალკე დიაგნოსტიკაა; ეს არ ამტკიცებს კანდიდატის ატვირთვის მთლიანი პროცესის გაუმართაობას.
- `city` — ქალაქი მხოლოდ ქართული ქალაქების დახურული სიიდან იძებნება (`lib/cv-parse.ts:50`, `:269`); Boston არ ინახება.
- `certifications` — სტრუქტურირებული ველი არ არსებობს: `lib/company-candidates.ts:46` და `lib/cv-parse.ts:291`. ტექსტში შენარჩუნება ცალკე დიაგნოსტიკაა; ეს არ ამტკიცებს კანდიდატის ატვირთვის მთლიანი პროცესის გაუმართაობას.
- `roleDates` — სტრუქტურირებული ველი არ არსებობს: `lib/company-candidates.ts:46` და `lib/cv-parse.ts:291`. ტექსტში შენარჩუნება ცალკე დიაგნოსტიკაა; ეს არ ამტკიცებს კანდიდატის ატვირთვის მთლიანი პროცესის გაუმართაობას.

### hh-ru.pdf

ამოღებულია 317 სიმბოლო; დრო 6.14 ms (ამოღება 5.45, პარსინგი 0.69). ზუსტად სწორი ველები: city, education, educationLevel, languages.

ტექსტში სახელი/email/phone: {"name": true, "email": true, "phone": true}.

- `name` — სტრუქტურირებული ველი არ არსებობს: `lib/company-candidates.ts:46` და `lib/cv-parse.ts:291`. ტექსტში შენარჩუნება ცალკე დიაგნოსტიკაა; ეს არ ამტკიცებს კანდიდატის ატვირთვის მთლიანი პროცესის გაუმართაობას.
- `email` — სტრუქტურირებული ველი არ არსებობს: `lib/company-candidates.ts:46` და `lib/cv-parse.ts:291`. ტექსტში შენარჩუნება ცალკე დიაგნოსტიკაა; ეს არ ამტკიცებს კანდიდატის ატვირთვის მთლიანი პროცესის გაუმართაობას.
- `phone` — სტრუქტურირებული ველი არ არსებობს: `lib/company-candidates.ts:46` და `lib/cv-parse.ts:291`. ტექსტში შენარჩუნება ცალკე დიაგნოსტიკაა; ეს არ ამტკიცებს კანდიდატის ატვირთვის მთლიანი პროცესის გაუმართაობას.
- `roles` — სექციის სათაური ზუსტად უნდა ემთხვეოდეს ჩამონათვალს (`lib/cv-parse.ts:185`, `:189`, `:191`, `:195`); ამ ნიმუშის სათაური არ ემთხვევა. `Опыт работы — 6 лет 3 месяца` შეიცავს დამატებით ტექსტს.
- `years` — სექციის სათაური ზუსტად უნდა ემთხვეოდეს ჩამონათვალს (`lib/cv-parse.ts:185`, `:189`, `:191`, `:195`); ამ ნიმუშის სათაური არ ემთხვევა. მიმდინარე რუსული თარიღი მხარდაჭერილია (`lib/cv-parse.ts:147`), მაგრამ work სექცია ცარიელია; ეს თარიღის ამომცნობის ხარვეზი არ არის.
- `skills` — Inline `Знание языков: ...` და `Сертификаты` ვერ წყვეტს skills სექციას (`lib/cv-parse.ts:195`, `:203`); ენები/სათაური უნარებად ემატება (`:277`). ბუღალტერია პროფესიიდან დამატებით გამოიცნობა (`:47`, `:283`); მკაცრი ქულა მხოლოდ განცხადებულ უნარებს ითვლის.
- `certifications` — სტრუქტურირებული ველი არ არსებობს: `lib/company-candidates.ts:46` და `lib/cv-parse.ts:291`. ტექსტში შენარჩუნება ცალკე დიაგნოსტიკაა; ეს არ ამტკიცებს კანდიდატის ატვირთვის მთლიანი პროცესის გაუმართაობას.
- `roleDates` — სტრუქტურირებული ველი არ არსებობს: `lib/company-candidates.ts:46` და `lib/cv-parse.ts:291`. ტექსტში შენარჩუნება ცალკე დიაგნოსტიკაა; ეს არ ამტკიცებს კანდიდატის ატვირთვის მთლიანი პროცესის გაუმართაობას.

### georgian.pdf

ამოღებულია 284 სიმბოლო; დრო 6.8 ms (ამოღება 6.11, პარსინგი 0.69). ზუსტად სწორი ველები: city, education, educationLevel, skills, languages.

ტექსტში სახელი/email/phone: {"name": true, "email": true, "phone": true}.

- `name` — სტრუქტურირებული ველი არ არსებობს: `lib/company-candidates.ts:46` და `lib/cv-parse.ts:291`. ტექსტში შენარჩუნება ცალკე დიაგნოსტიკაა; ეს არ ამტკიცებს კანდიდატის ატვირთვის მთლიანი პროცესის გაუმართაობას.
- `email` — სტრუქტურირებული ველი არ არსებობს: `lib/company-candidates.ts:46` და `lib/cv-parse.ts:291`. ტექსტში შენარჩუნება ცალკე დიაგნოსტიკაა; ეს არ ამტკიცებს კანდიდატის ატვირთვის მთლიანი პროცესის გაუმართაობას.
- `phone` — სტრუქტურირებული ველი არ არსებობს: `lib/company-candidates.ts:46` და `lib/cv-parse.ts:291`. ტექსტში შენარჩუნება ცალკე დიაგნოსტიკაა; ეს არ ამტკიცებს კანდიდატის ატვირთვის მთლიანი პროცესის გაუმართაობას.
- `roles` — წელი-წლის-თვე ფორმატი არ არის dateToken-ში (`lib/cv-parse.ts:145`); fallback თვით თარიღის ხაზსაც როლად ამატებს (`:263`).
- `years` — `2021 წლის მარტი` არ ემთხვევა თვე+წელს ან რიცხვით ტოკენს (`lib/cv-parse.ts:145`, `:207`).
- `certifications` — სტრუქტურირებული ველი არ არსებობს: `lib/company-candidates.ts:46` და `lib/cv-parse.ts:291`. ტექსტში შენარჩუნება ცალკე დიაგნოსტიკაა; ეს არ ამტკიცებს კანდიდატის ატვირთვის მთლიანი პროცესის გაუმართაობას.
- `roleDates` — სტრუქტურირებული ველი არ არსებობს: `lib/company-candidates.ts:46` და `lib/cv-parse.ts:291`. ტექსტში შენარჩუნება ცალკე დიაგნოსტიკაა; ეს არ ამტკიცებს კანდიდატის ატვირთვის მთლიანი პროცესის გაუმართაობას.

### georgian-acadnusx.txt

ამოღებულია 0 სიმბოლო; დრო 0.21 ms (ამოღება 0.02, პარსინგი 0.19). ზუსტად სწორი ველები: არცერთი.

ტექსტში სახელი/email/phone: {"name": false, "email": false, "phone": false}.

- `name` — სტრუქტურირებული ველი არ არსებობს: `lib/company-candidates.ts:46` და `lib/cv-parse.ts:291`. ტექსტში შენარჩუნება ცალკე დიაგნოსტიკაა; ეს არ ამტკიცებს კანდიდატის ატვირთვის მთლიანი პროცესის გაუმართაობას.
- `email` — სტრუქტურირებული ველი არ არსებობს: `lib/company-candidates.ts:46` და `lib/cv-parse.ts:291`. ტექსტში შენარჩუნება ცალკე დიაგნოსტიკაა; ეს არ ამტკიცებს კანდიდატის ატვირთვის მთლიანი პროცესის გაუმართაობას.
- `phone` — სტრუქტურირებული ველი არ არსებობს: `lib/company-candidates.ts:46` და `lib/cv-parse.ts:291`. ტექსტში შენარჩუნება ცალკე დიაგნოსტიკაა; ეს არ ამტკიცებს კანდიდატის ატვირთვის მთლიანი პროცესის გაუმართაობას.
- `city` — გაფართოების ადრეული დაბრუნება ცარიელი ტექსტით: `lib/server/cv-text.ts:76`, `:85`; TXT/RTF/ODT მხარდაჭერილი არ არის.
- `roles` — გაფართოების ადრეული დაბრუნება ცარიელი ტექსტით: `lib/server/cv-text.ts:76`, `:85`; TXT/RTF/ODT მხარდაჭერილი არ არის.
- `years` — გაფართოების ადრეული დაბრუნება ცარიელი ტექსტით: `lib/server/cv-text.ts:76`, `:85`; TXT/RTF/ODT მხარდაჭერილი არ არის.
- `education` — გაფართოების ადრეული დაბრუნება ცარიელი ტექსტით: `lib/server/cv-text.ts:76`, `:85`; TXT/RTF/ODT მხარდაჭერილი არ არის.
- `educationLevel` — გაფართოების ადრეული დაბრუნება ცარიელი ტექსტით: `lib/server/cv-text.ts:76`, `:85`; TXT/RTF/ODT მხარდაჭერილი არ არის.
- `skills` — გაფართოების ადრეული დაბრუნება ცარიელი ტექსტით: `lib/server/cv-text.ts:76`, `:85`; TXT/RTF/ODT მხარდაჭერილი არ არის.
- `languages` — გაფართოების ადრეული დაბრუნება ცარიელი ტექსტით: `lib/server/cv-text.ts:76`, `:85`; TXT/RTF/ODT მხარდაჭერილი არ არის.
- `certifications` — სტრუქტურირებული ველი არ არსებობს: `lib/company-candidates.ts:46` და `lib/cv-parse.ts:291`. ტექსტში შენარჩუნება ცალკე დიაგნოსტიკაა; ეს არ ამტკიცებს კანდიდატის ატვირთვის მთლიანი პროცესის გაუმართაობას.
- `roleDates` — სტრუქტურირებული ველი არ არსებობს: `lib/company-candidates.ts:46` და `lib/cv-parse.ts:291`. ტექსტში შენარჩუნება ცალკე დიაგნოსტიკაა; ეს არ ამტკიცებს კანდიდატის ატვირთვის მთლიანი პროცესის გაუმართაობას.

### georgian-acadnusx.pdf

ამოღებულია 284 სიმბოლო; დრო 6.08 ms (ამოღება 5.62, პარსინგი 0.46). ზუსტად სწორი ველები: city.

ტექსტში სახელი/email/phone: {"name": false, "email": true, "phone": true}.

- `name` — სტრუქტურირებული ველი არ არსებობს: `lib/company-candidates.ts:46` და `lib/cv-parse.ts:291`. ტექსტში შენარჩუნება ცალკე დიაგნოსტიკაა; ეს არ ამტკიცებს კანდიდატის ატვირთვის მთლიანი პროცესის გაუმართაობას.
- `email` — სტრუქტურირებული ველი არ არსებობს: `lib/company-candidates.ts:46` და `lib/cv-parse.ts:291`. ტექსტში შენარჩუნება ცალკე დიაგნოსტიკაა; ეს არ ამტკიცებს კანდიდატის ატვირთვის მთლიანი პროცესის გაუმართაობას.
- `phone` — სტრუქტურირებული ველი არ არსებობს: `lib/company-candidates.ts:46` და `lib/cv-parse.ts:291`. ტექსტში შენარჩუნება ცალკე დიაგნოსტიკაა; ეს არ ამტკიცებს კანდიდატის ატვირთვის მთლიანი პროცესის გაუმართაობას.
- `roles` — AcadNusx-ის ლათინური კოდების ქართული Unicode-ით ჩანაცვლება არ ხდება (`lib/cv-parse.ts:8`, `:170`); ქართული სათაურები/ენის სახელები/სიტყვები შესაბამის ლათინურ ფორმებს არ შეიცავს (`:11`, `:26`, `:185`).
- `years` — AcadNusx-ის ლათინური კოდების ქართული Unicode-ით ჩანაცვლება არ ხდება (`lib/cv-parse.ts:8`, `:170`); ქართული სათაურები/ენის სახელები/სიტყვები შესაბამის ლათინურ ფორმებს არ შეიცავს (`:11`, `:26`, `:185`).
- `education` — AcadNusx-ის ლათინური კოდების ქართული Unicode-ით ჩანაცვლება არ ხდება (`lib/cv-parse.ts:8`, `:170`); ქართული სათაურები/ენის სახელები/სიტყვები შესაბამის ლათინურ ფორმებს არ შეიცავს (`:11`, `:26`, `:185`).
- `educationLevel` — AcadNusx-ის ლათინური კოდების ქართული Unicode-ით ჩანაცვლება არ ხდება (`lib/cv-parse.ts:8`, `:170`); ქართული სათაურები/ენის სახელები/სიტყვები შესაბამის ლათინურ ფორმებს არ შეიცავს (`:11`, `:26`, `:185`).
- `skills` — AcadNusx-ის ლათინური კოდების ქართული Unicode-ით ჩანაცვლება არ ხდება (`lib/cv-parse.ts:8`, `:170`); ქართული სათაურები/ენის სახელები/სიტყვები შესაბამის ლათინურ ფორმებს არ შეიცავს (`:11`, `:26`, `:185`).
- `languages` — AcadNusx-ის ლათინური კოდების ქართული Unicode-ით ჩანაცვლება არ ხდება (`lib/cv-parse.ts:8`, `:170`); ქართული სათაურები/ენის სახელები/სიტყვები შესაბამის ლათინურ ფორმებს არ შეიცავს (`:11`, `:26`, `:185`).
- `certifications` — სტრუქტურირებული ველი არ არსებობს: `lib/company-candidates.ts:46` და `lib/cv-parse.ts:291`. ტექსტში შენარჩუნება ცალკე დიაგნოსტიკაა; ეს არ ამტკიცებს კანდიდატის ატვირთვის მთლიანი პროცესის გაუმართაობას.
- `roleDates` — სტრუქტურირებული ველი არ არსებობს: `lib/company-candidates.ts:46` და `lib/cv-parse.ts:291`. ტექსტში შენარჩუნება ცალკე დიაგნოსტიკაა; ეს არ ამტკიცებს კანდიდატის ატვირთვის მთლიანი პროცესის გაუმართაობას.

### word-table.docx

ამოღებულია 380 სიმბოლო; დრო 2.09 ms (ამოღება 0.93, პარსინგი 1.16). ზუსტად სწორი ველები: years, education, educationLevel, skills, languages.

ტექსტში სახელი/email/phone: {"name": false, "email": true, "phone": true}.

- `name` — სტრუქტურირებული ველი არ არსებობს: `lib/company-candidates.ts:46` და `lib/cv-parse.ts:291`. ტექსტში შენარჩუნება ცალკე დიაგნოსტიკაა; ეს არ ამტკიცებს კანდიდატის ატვირთვის მთლიანი პროცესის გაუმართაობას. დამატებით, header ტექსტი საერთოდ არ ამოიღება: იკითხება მხოლოდ word/document.xml (`lib/server/cv-text.ts:41`).
- `email` — სტრუქტურირებული ველი არ არსებობს: `lib/company-candidates.ts:46` და `lib/cv-parse.ts:291`. ტექსტში შენარჩუნება ცალკე დიაგნოსტიკაა; ეს არ ამტკიცებს კანდიდატის ატვირთვის მთლიანი პროცესის გაუმართაობას.
- `phone` — სტრუქტურირებული ველი არ არსებობს: `lib/company-candidates.ts:46` და `lib/cv-parse.ts:291`. ტექსტში შენარჩუნება ცალკე დიაგნოსტიკაა; ეს არ ამტკიცებს კანდიდატის ატვირთვის მთლიანი პროცესის გაუმართაობას.
- `city` — Boston არ არის ქალაქების სიაში (`lib/cv-parse.ts:50`, `:269`).
- `roles` — DOCX-ის აბზაცები ბრტყელ ტექსტად იქცევა, ცხრილის სტრუქტურა არ ინახება (`lib/server/cv-text.ts:5`, `:61`); პარსერი თარიღამდე არსებულ pending ხაზებს იყენებს (`lib/cv-parse.ts:247`, `:254`). Date | role ცხრილში პირველი როლი მეორე თარიღს მიეწერება, მეორე საერთოდ იკარგება.
- `certifications` — სტრუქტურირებული ველი არ არსებობს: `lib/company-candidates.ts:46` და `lib/cv-parse.ts:291`. ტექსტში შენარჩუნება ცალკე დიაგნოსტიკაა; ეს არ ამტკიცებს კანდიდატის ატვირთვის მთლიანი პროცესის გაუმართაობას.
- `roleDates` — სტრუქტურირებული ველი არ არსებობს: `lib/company-candidates.ts:46` და `lib/cv-parse.ts:291`. ტექსტში შენარჩუნება ცალკე დიაგნოსტიკაა; ეს არ ამტკიცებს კანდიდატის ატვირთვის მთლიანი პროცესის გაუმართაობას.

### scanned.pdf

ამოღებულია 0 სიმბოლო; დრო 3.13 ms (ამოღება 2.96, პარსინგი 0.17). ზუსტად სწორი ველები: არცერთი.

ტექსტში სახელი/email/phone: {"name": false, "email": false, "phone": false}.

- `name` — სტრუქტურირებული ველი არ არსებობს: `lib/company-candidates.ts:46` და `lib/cv-parse.ts:291`. ტექსტში შენარჩუნება ცალკე დიაგნოსტიკაა; ეს არ ამტკიცებს კანდიდატის ატვირთვის მთლიანი პროცესის გაუმართაობას.
- `email` — სტრუქტურირებული ველი არ არსებობს: `lib/company-candidates.ts:46` და `lib/cv-parse.ts:291`. ტექსტში შენარჩუნება ცალკე დიაგნოსტიკაა; ეს არ ამტკიცებს კანდიდატის ატვირთვის მთლიანი პროცესის გაუმართაობას.
- `phone` — სტრუქტურირებული ველი არ არსებობს: `lib/company-candidates.ts:46` და `lib/cv-parse.ts:291`. ტექსტში შენარჩუნება ცალკე დიაგნოსტიკაა; ეს არ ამტკიცებს კანდიდატის ატვირთვის მთლიანი პროცესის გაუმართაობას.
- `city` — მხოლოდ `getTextContent()` გამოიყენება (`lib/server/cv-text.ts:115`); გამოსახულებისთვის OCR გზა არ არსებობს; შედეგად 0 სიმბოლო და ცარიელი პროფილია.
- `roles` — მხოლოდ `getTextContent()` გამოიყენება (`lib/server/cv-text.ts:115`); გამოსახულებისთვის OCR გზა არ არსებობს; შედეგად 0 სიმბოლო და ცარიელი პროფილია.
- `years` — მხოლოდ `getTextContent()` გამოიყენება (`lib/server/cv-text.ts:115`); გამოსახულებისთვის OCR გზა არ არსებობს; შედეგად 0 სიმბოლო და ცარიელი პროფილია.
- `education` — მხოლოდ `getTextContent()` გამოიყენება (`lib/server/cv-text.ts:115`); გამოსახულებისთვის OCR გზა არ არსებობს; შედეგად 0 სიმბოლო და ცარიელი პროფილია.
- `educationLevel` — მხოლოდ `getTextContent()` გამოიყენება (`lib/server/cv-text.ts:115`); გამოსახულებისთვის OCR გზა არ არსებობს; შედეგად 0 სიმბოლო და ცარიელი პროფილია.
- `skills` — მხოლოდ `getTextContent()` გამოიყენება (`lib/server/cv-text.ts:115`); გამოსახულებისთვის OCR გზა არ არსებობს; შედეგად 0 სიმბოლო და ცარიელი პროფილია.
- `languages` — მხოლოდ `getTextContent()` გამოიყენება (`lib/server/cv-text.ts:115`); გამოსახულებისთვის OCR გზა არ არსებობს; შედეგად 0 სიმბოლო და ცარიელი პროფილია.
- `certifications` — სტრუქტურირებული ველი არ არსებობს: `lib/company-candidates.ts:46` და `lib/cv-parse.ts:291`. ტექსტში შენარჩუნება ცალკე დიაგნოსტიკაა; ეს არ ამტკიცებს კანდიდატის ატვირთვის მთლიანი პროცესის გაუმართაობას.
- `roleDates` — სტრუქტურირებული ველი არ არსებობს: `lib/company-candidates.ts:46` და `lib/cv-parse.ts:291`. ტექსტში შენარჩუნება ცალკე დიაგნოსტიკაა; ეს არ ამტკიცებს კანდიდატის ატვირთვის მთლიანი პროცესის გაუმართაობას.

### us-resume.rtf

ამოღებულია 0 სიმბოლო; დრო 0.12 ms (ამოღება 0.02, პარსინგი 0.1). ზუსტად სწორი ველები: არცერთი.

ტექსტში სახელი/email/phone: {"name": false, "email": false, "phone": false}.

- `name` — სტრუქტურირებული ველი არ არსებობს: `lib/company-candidates.ts:46` და `lib/cv-parse.ts:291`. ტექსტში შენარჩუნება ცალკე დიაგნოსტიკაა; ეს არ ამტკიცებს კანდიდატის ატვირთვის მთლიანი პროცესის გაუმართაობას.
- `email` — სტრუქტურირებული ველი არ არსებობს: `lib/company-candidates.ts:46` და `lib/cv-parse.ts:291`. ტექსტში შენარჩუნება ცალკე დიაგნოსტიკაა; ეს არ ამტკიცებს კანდიდატის ატვირთვის მთლიანი პროცესის გაუმართაობას.
- `phone` — სტრუქტურირებული ველი არ არსებობს: `lib/company-candidates.ts:46` და `lib/cv-parse.ts:291`. ტექსტში შენარჩუნება ცალკე დიაგნოსტიკაა; ეს არ ამტკიცებს კანდიდატის ატვირთვის მთლიანი პროცესის გაუმართაობას.
- `city` — გაფართოების ადრეული დაბრუნება ცარიელი ტექსტით: `lib/server/cv-text.ts:76`, `:85`; TXT/RTF/ODT მხარდაჭერილი არ არის.
- `roles` — გაფართოების ადრეული დაბრუნება ცარიელი ტექსტით: `lib/server/cv-text.ts:76`, `:85`; TXT/RTF/ODT მხარდაჭერილი არ არის.
- `years` — გაფართოების ადრეული დაბრუნება ცარიელი ტექსტით: `lib/server/cv-text.ts:76`, `:85`; TXT/RTF/ODT მხარდაჭერილი არ არის.
- `education` — გაფართოების ადრეული დაბრუნება ცარიელი ტექსტით: `lib/server/cv-text.ts:76`, `:85`; TXT/RTF/ODT მხარდაჭერილი არ არის.
- `educationLevel` — გაფართოების ადრეული დაბრუნება ცარიელი ტექსტით: `lib/server/cv-text.ts:76`, `:85`; TXT/RTF/ODT მხარდაჭერილი არ არის.
- `skills` — გაფართოების ადრეული დაბრუნება ცარიელი ტექსტით: `lib/server/cv-text.ts:76`, `:85`; TXT/RTF/ODT მხარდაჭერილი არ არის.
- `languages` — გაფართოების ადრეული დაბრუნება ცარიელი ტექსტით: `lib/server/cv-text.ts:76`, `:85`; TXT/RTF/ODT მხარდაჭერილი არ არის.
- `certifications` — სტრუქტურირებული ველი არ არსებობს: `lib/company-candidates.ts:46` და `lib/cv-parse.ts:291`. ტექსტში შენარჩუნება ცალკე დიაგნოსტიკაა; ეს არ ამტკიცებს კანდიდატის ატვირთვის მთლიანი პროცესის გაუმართაობას.
- `roleDates` — სტრუქტურირებული ველი არ არსებობს: `lib/company-candidates.ts:46` და `lib/cv-parse.ts:291`. ტექსტში შენარჩუნება ცალკე დიაგნოსტიკაა; ეს არ ამტკიცებს კანდიდატის ატვირთვის მთლიანი პროცესის გაუმართაობას.

### us-resume.odt

ამოღებულია 0 სიმბოლო; დრო 0.09 ms (ამოღება 0.01, პარსინგი 0.08). ზუსტად სწორი ველები: არცერთი.

ტექსტში სახელი/email/phone: {"name": false, "email": false, "phone": false}.

- `name` — სტრუქტურირებული ველი არ არსებობს: `lib/company-candidates.ts:46` და `lib/cv-parse.ts:291`. ტექსტში შენარჩუნება ცალკე დიაგნოსტიკაა; ეს არ ამტკიცებს კანდიდატის ატვირთვის მთლიანი პროცესის გაუმართაობას.
- `email` — სტრუქტურირებული ველი არ არსებობს: `lib/company-candidates.ts:46` და `lib/cv-parse.ts:291`. ტექსტში შენარჩუნება ცალკე დიაგნოსტიკაა; ეს არ ამტკიცებს კანდიდატის ატვირთვის მთლიანი პროცესის გაუმართაობას.
- `phone` — სტრუქტურირებული ველი არ არსებობს: `lib/company-candidates.ts:46` და `lib/cv-parse.ts:291`. ტექსტში შენარჩუნება ცალკე დიაგნოსტიკაა; ეს არ ამტკიცებს კანდიდატის ატვირთვის მთლიანი პროცესის გაუმართაობას.
- `city` — გაფართოების ადრეული დაბრუნება ცარიელი ტექსტით: `lib/server/cv-text.ts:76`, `:85`; TXT/RTF/ODT მხარდაჭერილი არ არის.
- `roles` — გაფართოების ადრეული დაბრუნება ცარიელი ტექსტით: `lib/server/cv-text.ts:76`, `:85`; TXT/RTF/ODT მხარდაჭერილი არ არის.
- `years` — გაფართოების ადრეული დაბრუნება ცარიელი ტექსტით: `lib/server/cv-text.ts:76`, `:85`; TXT/RTF/ODT მხარდაჭერილი არ არის.
- `education` — გაფართოების ადრეული დაბრუნება ცარიელი ტექსტით: `lib/server/cv-text.ts:76`, `:85`; TXT/RTF/ODT მხარდაჭერილი არ არის.
- `educationLevel` — გაფართოების ადრეული დაბრუნება ცარიელი ტექსტით: `lib/server/cv-text.ts:76`, `:85`; TXT/RTF/ODT მხარდაჭერილი არ არის.
- `skills` — გაფართოების ადრეული დაბრუნება ცარიელი ტექსტით: `lib/server/cv-text.ts:76`, `:85`; TXT/RTF/ODT მხარდაჭერილი არ არის.
- `languages` — გაფართოების ადრეული დაბრუნება ცარიელი ტექსტით: `lib/server/cv-text.ts:76`, `:85`; TXT/RTF/ODT მხარდაჭერილი არ არის.
- `certifications` — სტრუქტურირებული ველი არ არსებობს: `lib/company-candidates.ts:46` და `lib/cv-parse.ts:291`. ტექსტში შენარჩუნება ცალკე დიაგნოსტიკაა; ეს არ ამტკიცებს კანდიდატის ატვირთვის მთლიანი პროცესის გაუმართაობას.
- `roleDates` — სტრუქტურირებული ველი არ არსებობს: `lib/company-candidates.ts:46` და `lib/cv-parse.ts:291`. ტექსტში შენარჩუნება ცალკე დიაგნოსტიკაა; ეს არ ამტკიცებს კანდიდატის ატვირთვის მთლიანი პროცესის გაუმართაობას.

## გავლენის მიხედვით 10 მთავარი შეზღუდვა

1. კონტაქტების, სერტიფიკატებისა და სამუშაოს თარიღების სტრუქტურირებული ველები არ არსებობს — 60/144 ჯგუფი ამ მიზეზით ვერ სრულდება; ამომღების და კანდიდატის მთელი მოდელის პრობლემები არ უნდა ავურიოთ.
2. RTF/ODT/TXT ფორმატებს ამომღები ცარიელი შედეგით პასუხობს; მიზეზს არ აბრუნებს.
3. სკანირებულ PDF-ზე OCR არ არსებობს; ფაილი ვიზუალურად იკითხება, ტექსტი 0-ია.
4. სვეტები დაფიქსირებულია გვერდის შუაზე: LinkedIn-ის ტიპური 30% გვერდითი ზოლი სექციებს ერთმანეთში ურევს.
5. სათაურების მხოლოდ ზუსტი დამთხვევა: Europass-ის გაფართოებული სათაურები, hh-ის სტაჟიანი სათაური და დიზაინერის spaced capitals გამოცდილებას/განათლებას აკარგვინებს.
6. თარიღები: dd/mm/yyyy ნაწილობრივ იკითხება; ქართული „2021 წლის მარტი“ საერთოდ ვერ იკითხება. შეიძლება მიიღოს არასწორი როლი და შემცირებული სტაჟი.
7. DOCX header გამოტოვებულია; date-first ცხრილში როლი არასწორ თარიღს უკავშირდება და ერთი როლი იკარგება.
8. AcadNusx ტექსტის Unicode-ში კონვერტაცია არ არსებობს; შეიძლება ქალაქი შემთხვევით ამოიცნოს (Tbilisi), მაგრამ ძირითადი ქართული ინფორმაცია იკარგება.
9. ენებისა და უნარების საზღვრები: mother-tongue სახელამდე ვერ მიებმება დონეს; Full Professional-ის raw დონე იკარგება; inline რუსული ენები/სერტიფიკატის სათაური უნარებად იქცევა. უცნობი უნარები მხოლოდ ამოცნობილ skills სექციაში გადარჩება.
10. ქალაქები მხოლოდ საქართველოს ფიქსირებული სიით: Boston ამოუცნობია, მიუხედავად იმისა, რომ ტექსტში არის.

## შემოწმებები და საზღვრები

- `npx tsx tests/fixtures/cv-samples/generate.ts`: exit 0; `Generated 12 synthetic CV fixtures.`
- `npx tsx tests/fixtures/cv-samples/evaluate.ts`: exit 0; სრული stdout ქვემოთაა; stderr-ში მხოლოდ Node MockTimers ExperimentalWarning (შენახულია evaluation-stderr.txt). პირველი PDF-ის დრო შეიცავს pdf.js-ის cold import-ს და სხვებთან პირდაპირ შესადარებელი არ არის.
- `npx tsc --noEmit -p . --incremental false`: ცვლილებამდე და საბოლოო კოდზე exit 0, stdout/stderr ცარიელი. `--incremental false` გამორიცხავს გამიზნული დირექტორიის გარეთ tsbuildinfo-ის ჩაწერას.
- ZIP CRC და XML well-formedness: DOCX/ODT PASS; ODT mimetype პირველი და uncompressed-ია. სრული Office/ODF schema validation და Word-ში ვიზუალური გახსნა არ ჩატარებულა.
- რვავე PDF დარენდერებულია `pdftoppm`-ით; განახლებული contact-sheet ვიზუალურად შემოწმებულია, ტექსტი არ იჭრება, ქართული/რუსული გლიფები იკითხება.
- Pillow გარემოში არ იყო; ჩანაცვლდა უკვე არსებული @napi-rs/canvas-ით, პაკეტი არ დამიყენებია.
- `git status --short` აღებულია მუშაობამდე/შემდეგ. გარემოში მანამდეც ბევრი სხვისი ცვლილება იყო. ყველა ჩემი ფაილი მხოლოდ tests/fixtures/cv-samples/-შია; status snapshot ვერ ადასტურებს სხვა აგენტის პარალელურ ცვლილებებზე ავტორობას. ფაილების სახელების სრული სია ქვემოთაა.
- task board მხოლოდ წავიკითხე; ახალი ჩანაწერი არ შემიქმნია, რადგან ჩაწერა მხოლოდ ამ დირექტორიაში იყო დაშვებული. Next API და UI არ შეცვლილა. მოქმედ აპში შემოწმება არ ჩატარებულა; მონაცემთა ბაზასთან კავშირი არ ყოფილა.

## შემოწმებული წყაროს SHA-256

- `lib/cv-parse.ts`: `2c8dcb02e3e95a2e490cf4aaa1e38669ab0835f8479834f32c2fe026cbb9f741`
- `lib/server/cv-text.ts`: `eab630fae42d7d674962c9c45be973214475cb03765a89440a307ba7d0246c8c`
- `lib/company-candidates.ts`: `2d1168e7e5b46aedddccc96f1dfa89d39c86f06e7879a817ca5c345c627b2e2b`

## შექმნილი ფაილები

- `REPORT.md`
- `contact-sheet.png`
- `europass-en-preview.png`
- `europass-en.pdf`
- `evaluate.ts`
- `evaluation-stderr.txt`
- `evaluation.txt`
- `expected.json`
- `generate.ts`
- `georgian-acadnusx-preview.png`
- `georgian-acadnusx.pdf`
- `georgian-acadnusx.txt`
- `georgian-preview.png`
- `georgian.pdf`
- `hh-ru-preview.png`
- `hh-ru.pdf`
- `linkedin-export-preview.png`
- `linkedin-export.pdf`
- `package-check.txt`
- `results.json`
- `scanned-preview.png`
- `scanned-source.png`
- `scanned.pdf`
- `status-after.txt`
- `status-before.txt`
- `tsc-after.txt`
- `tsc-before.txt`
- `two-column-canva-preview.png`
- `two-column-canva.pdf`
- `us-resume-preview.png`
- `us-resume.odt`
- `us-resume.pdf`
- `us-resume.rtf`
- `word-table.docx`
- `write-report.py`

## evaluate.ts — სრული stdout

```text
As of 2026-11-16T12:00:00Z. Exact field-group equality; arrays compared unordered; extras fail.

| fixture | extracted chars | field | expected | actual | OK/MISS |
|---|---:|---|---|---|---|
| europass-en.pdf | 471 | name | "Alex Sample" | "(not exposed by parser schema)" | MISS |
| europass-en.pdf | 471 | email | "synthetic1@example.com" | "(not exposed by parser schema)" | MISS |
| europass-en.pdf | 471 | phone | "+995 555 00 00 01" | "(not exposed by parser schema)" | MISS |
| europass-en.pdf | 471 | city | "თბილისი" | "თბილისი" | OK |
| europass-en.pdf | 471 | roles | ["Data Analyst — Example Europe","Junior Analyst — Sample Europe"] | ["01/"] | MISS |
| europass-en.pdf | 471 | years | 7 | 4 | MISS |
| europass-en.pdf | 471 | education | ["Bachelor of Science — Example University"] | [] | MISS |
| europass-en.pdf | 471 | educationLevel | "bachelor" | null | MISS |
| europass-en.pdf | 471 | skills | ["Excel","SQL","Data visualization"] | ["Excel","SQL"] | MISS |
| europass-en.pdf | 471 | languages | [{"name":"ქართული","level":"native"},{"name":"ინგლისური","level":"b2"}] | [{"name":"ქართული","level":null},{"name":"ინგლისური","level":"b2"}] | MISS |
| europass-en.pdf | 471 | certifications | ["Google Data Analytics Certificate"] | "(not exposed by parser schema)" | MISS |
| europass-en.pdf | 471 | roleDates | [{"start":"2022-07","end":"current"},{"start":"2019-03","end":"2022-06"}] | "(not exposed by parser schema)" | MISS |
| linkedin-export.pdf | 372 | name | "Robin Demo" | "(not exposed by parser schema)" | MISS |
| linkedin-export.pdf | 372 | email | "synthetic2@example.com" | "(not exposed by parser schema)" | MISS |
| linkedin-export.pdf | 372 | phone | "+995 555 00 00 02" | "(not exposed by parser schema)" | MISS |
| linkedin-export.pdf | 372 | city | "თბილისი" | "თბილისი" | OK |
| linkedin-export.pdf | 372 | roles | ["Product Analyst — Fictional Network"] | [] | MISS |
| linkedin-export.pdf | 372 | years | 6 | null | MISS |
| linkedin-export.pdf | 372 | education | ["Master of Science — Sample Institute"] | [] | MISS |
| linkedin-export.pdf | 372 | educationLevel | "master" | null | MISS |
| linkedin-export.pdf | 372 | skills | ["SQL","Tableau","Stakeholder management"] | ["SQL"] | MISS |
| linkedin-export.pdf | 372 | languages | [{"name":"ინგლისური","level":"full professional"}] | [{"name":"ინგლისური","level":null}] | MISS |
| linkedin-export.pdf | 372 | certifications | ["Professional Scrum Master I"] | "(not exposed by parser schema)" | MISS |
| linkedin-export.pdf | 372 | roleDates | [{"start":"2020-01","end":"current"}] | "(not exposed by parser schema)" | MISS |
| two-column-canva.pdf | 312 | name | "Dara Fiction" | "(not exposed by parser schema)" | MISS |
| two-column-canva.pdf | 312 | email | "synthetic3@example.com" | "(not exposed by parser schema)" | MISS |
| two-column-canva.pdf | 312 | phone | "+995 555 00 00 03" | "(not exposed by parser schema)" | MISS |
| two-column-canva.pdf | 312 | city | "ბათუმი" | "ბათუმი" | OK |
| two-column-canva.pdf | 312 | roles | ["Designer — Imaginary Studio"] | [] | MISS |
| two-column-canva.pdf | 312 | years | 4 | null | MISS |
| two-column-canva.pdf | 312 | education | ["Bachelor of Arts — Fictional Academy"] | [] | MISS |
| two-column-canva.pdf | 312 | educationLevel | "bachelor" | null | MISS |
| two-column-canva.pdf | 312 | skills | ["Figma","Photoshop","Typography"] | ["Photoshop","Figma"] | MISS |
| two-column-canva.pdf | 312 | languages | [{"name":"ინგლისური","level":"c1"}] | [{"name":"ინგლისური","level":"c1"}] | OK |
| two-column-canva.pdf | 312 | certifications | ["Design Foundations Certificate"] | "(not exposed by parser schema)" | MISS |
| two-column-canva.pdf | 312 | roleDates | [{"start":"2019","end":"2022"}] | "(not exposed by parser schema)" | MISS |
| us-resume.pdf | 392 | name | "Mira Example" | "(not exposed by parser schema)" | MISS |
| us-resume.pdf | 392 | email | "synthetic4@example.com" | "(not exposed by parser schema)" | MISS |
| us-resume.pdf | 392 | phone | "+995 555 00 00 04" | "(not exposed by parser schema)" | MISS |
| us-resume.pdf | 392 | city | "Boston" | "" | MISS |
| us-resume.pdf | 392 | roles | ["Senior Analyst — Fictional Labs","Analyst — Example Works"] | ["Senior Analyst — Fictional Labs","Analyst — Example Works"] | OK |
| us-resume.pdf | 392 | years | 5 | 5 | OK |
| us-resume.pdf | 392 | education | ["Bachelor of Science — Fictional University"] | ["Bachelor of Science — Fictional University"] | OK |
| us-resume.pdf | 392 | educationLevel | "bachelor" | "bachelor" | OK |
| us-resume.pdf | 392 | skills | ["SQL","Python","Tableau"] | ["SQL","Python","Tableau"] | OK |
| us-resume.pdf | 392 | languages | [{"name":"ინგლისური","level":"native"},{"name":"გერმანული","level":"b2"}] | [{"name":"ინგლისური","level":"native"},{"name":"გერმანული","level":"b2"}] | OK |
| us-resume.pdf | 392 | certifications | ["AWS Certified Cloud Practitioner"] | "(not exposed by parser schema)" | MISS |
| us-resume.pdf | 392 | roleDates | [{"start":"2020-01","end":"2023-12"},{"start":"2018-03","end":"2021-06"}] | "(not exposed by parser schema)" | MISS |
| hh-ru.pdf | 317 | name | "Алина Примерова" | "(not exposed by parser schema)" | MISS |
| hh-ru.pdf | 317 | email | "synthetic5@example.com" | "(not exposed by parser schema)" | MISS |
| hh-ru.pdf | 317 | phone | "+995 555 00 00 05" | "(not exposed by parser schema)" | MISS |
| hh-ru.pdf | 317 | city | "ქუთაისი" | "ქუთაისი" | OK |
| hh-ru.pdf | 317 | roles | ["Бухгалтер — Пример Компания"] | [] | MISS |
| hh-ru.pdf | 317 | years | 6 | null | MISS |
| hh-ru.pdf | 317 | education | ["Магистр экономики — Учебный институт"] | ["Магистр экономики — Учебный институт"] | OK |
| hh-ru.pdf | 317 | educationLevel | "master" | "master" | OK |
| hh-ru.pdf | 317 | skills | ["1C","Excel","CRM"] | ["Excel","1C","CRM","ბუღალტერია","Знание языков: Русский — Родной","Английский — B2","Сертификаты"] | MISS |
| hh-ru.pdf | 317 | languages | [{"name":"რუსული","level":"native"},{"name":"ინგლისური","level":"b2"}] | [{"name":"რუსული","level":"native"},{"name":"ინგლისური","level":"b2"}] | OK |
| hh-ru.pdf | 317 | certifications | ["Сертификат 1С Профессионал"] | "(not exposed by parser schema)" | MISS |
| hh-ru.pdf | 317 | roleDates | [{"start":"2020-06","end":"current"}] | "(not exposed by parser schema)" | MISS |
| georgian.pdf | 284 | name | "ნინა მაგალითაძე" | "(not exposed by parser schema)" | MISS |
| georgian.pdf | 284 | email | "synthetic6@example.com" | "(not exposed by parser schema)" | MISS |
| georgian.pdf | 284 | phone | "+995 555 00 00 06" | "(not exposed by parser schema)" | MISS |
| georgian.pdf | 284 | city | "თბილისი" | "თბილისი" | OK |
| georgian.pdf | 284 | roles | ["ბუღალტერი — სადემო კომპანია"] | ["ბუღალტერი — სადემო კომპანია","2021 წლის მარტი – დღემდე"] | MISS |
| georgian.pdf | 284 | years | 5 | null | MISS |
| georgian.pdf | 284 | education | ["ბაკალავრი — სადემო უნივერსიტეტი"] | ["ბაკალავრი — სადემო უნივერსიტეტი"] | OK |
| georgian.pdf | 284 | educationLevel | "bachelor" | "bachelor" | OK |
| georgian.pdf | 284 | skills | ["Excel","1C","ბუღალტერია"] | ["Excel","1C","ბუღალტერია"] | OK |
| georgian.pdf | 284 | languages | [{"name":"ქართული","level":"native"},{"name":"ინგლისური","level":"b2"}] | [{"name":"ქართული","level":"native"},{"name":"ინგლისური","level":"b2"}] | OK |
| georgian.pdf | 284 | certifications | ["ბუღალტერიის სერტიფიკატი"] | "(not exposed by parser schema)" | MISS |
| georgian.pdf | 284 | roleDates | [{"start":"2021-03","end":"current"}] | "(not exposed by parser schema)" | MISS |
| georgian-acadnusx.txt | 0 | name | "ნინა მაგალითაძე" | "(not exposed by parser schema)" | MISS |
| georgian-acadnusx.txt | 0 | email | "synthetic6@example.com" | "(not exposed by parser schema)" | MISS |
| georgian-acadnusx.txt | 0 | phone | "+995 555 00 00 06" | "(not exposed by parser schema)" | MISS |
| georgian-acadnusx.txt | 0 | city | "თბილისი" | "" | MISS |
| georgian-acadnusx.txt | 0 | roles | ["ბუღალტერი — სადემო კომპანია"] | [] | MISS |
| georgian-acadnusx.txt | 0 | years | 5 | null | MISS |
| georgian-acadnusx.txt | 0 | education | ["ბაკალავრი — სადემო უნივერსიტეტი"] | [] | MISS |
| georgian-acadnusx.txt | 0 | educationLevel | "bachelor" | null | MISS |
| georgian-acadnusx.txt | 0 | skills | ["Excel","1C","ბუღალტერია"] | [] | MISS |
| georgian-acadnusx.txt | 0 | languages | [{"name":"ქართული","level":"native"},{"name":"ინგლისური","level":"b2"}] | [] | MISS |
| georgian-acadnusx.txt | 0 | certifications | ["ბუღალტერიის სერტიფიკატი"] | "(not exposed by parser schema)" | MISS |
| georgian-acadnusx.txt | 0 | roleDates | [{"start":"2021-03","end":"current"}] | "(not exposed by parser schema)" | MISS |
| georgian-acadnusx.pdf | 284 | name | "ნინა მაგალითაძე" | "(not exposed by parser schema)" | MISS |
| georgian-acadnusx.pdf | 284 | email | "synthetic6@example.com" | "(not exposed by parser schema)" | MISS |
| georgian-acadnusx.pdf | 284 | phone | "+995 555 00 00 06" | "(not exposed by parser schema)" | MISS |
| georgian-acadnusx.pdf | 284 | city | "თბილისი" | "თბილისი" | OK |
| georgian-acadnusx.pdf | 284 | roles | ["ბუღალტერი — სადემო კომპანია"] | [] | MISS |
| georgian-acadnusx.pdf | 284 | years | 5 | null | MISS |
| georgian-acadnusx.pdf | 284 | education | ["ბაკალავრი — სადემო უნივერსიტეტი"] | [] | MISS |
| georgian-acadnusx.pdf | 284 | educationLevel | "bachelor" | null | MISS |
| georgian-acadnusx.pdf | 284 | skills | ["Excel","1C","ბუღალტერია"] | ["Excel","1C"] | MISS |
| georgian-acadnusx.pdf | 284 | languages | [{"name":"ქართული","level":"native"},{"name":"ინგლისური","level":"b2"}] | [] | MISS |
| georgian-acadnusx.pdf | 284 | certifications | ["ბუღალტერიის სერტიფიკატი"] | "(not exposed by parser schema)" | MISS |
| georgian-acadnusx.pdf | 284 | roleDates | [{"start":"2021-03","end":"current"}] | "(not exposed by parser schema)" | MISS |
| word-table.docx | 380 | name | "Mira Example" | "(not exposed by parser schema)" | MISS |
| word-table.docx | 380 | email | "synthetic4@example.com" | "(not exposed by parser schema)" | MISS |
| word-table.docx | 380 | phone | "+995 555 00 00 04" | "(not exposed by parser schema)" | MISS |
| word-table.docx | 380 | city | "Boston" | "" | MISS |
| word-table.docx | 380 | roles | ["Senior Analyst — Fictional Labs","Analyst — Example Works"] | ["Senior Analyst — Fictional Labs"] | MISS |
| word-table.docx | 380 | years | 5 | 5 | OK |
| word-table.docx | 380 | education | ["Bachelor of Science — Fictional University"] | ["Bachelor of Science — Fictional University"] | OK |
| word-table.docx | 380 | educationLevel | "bachelor" | "bachelor" | OK |
| word-table.docx | 380 | skills | ["SQL","Python","Tableau"] | ["SQL","Python","Tableau"] | OK |
| word-table.docx | 380 | languages | [{"name":"ინგლისური","level":"native"},{"name":"გერმანული","level":"b2"}] | [{"name":"ინგლისური","level":"native"},{"name":"გერმანული","level":"b2"}] | OK |
| word-table.docx | 380 | certifications | ["AWS Certified Cloud Practitioner"] | "(not exposed by parser schema)" | MISS |
| word-table.docx | 380 | roleDates | [{"start":"2020-01","end":"2023-12"},{"start":"2018-03","end":"2021-06"}] | "(not exposed by parser schema)" | MISS |
| scanned.pdf | 0 | name | "Mira Example" | "(not exposed by parser schema)" | MISS |
| scanned.pdf | 0 | email | "synthetic4@example.com" | "(not exposed by parser schema)" | MISS |
| scanned.pdf | 0 | phone | "+995 555 00 00 04" | "(not exposed by parser schema)" | MISS |
| scanned.pdf | 0 | city | "Boston" | "" | MISS |
| scanned.pdf | 0 | roles | ["Senior Analyst — Fictional Labs","Analyst — Example Works"] | [] | MISS |
| scanned.pdf | 0 | years | 5 | null | MISS |
| scanned.pdf | 0 | education | ["Bachelor of Science — Fictional University"] | [] | MISS |
| scanned.pdf | 0 | educationLevel | "bachelor" | null | MISS |
| scanned.pdf | 0 | skills | ["SQL","Python","Tableau"] | [] | MISS |
| scanned.pdf | 0 | languages | [{"name":"ინგლისური","level":"native"},{"name":"გერმანული","level":"b2"}] | [] | MISS |
| scanned.pdf | 0 | certifications | ["AWS Certified Cloud Practitioner"] | "(not exposed by parser schema)" | MISS |
| scanned.pdf | 0 | roleDates | [{"start":"2020-01","end":"2023-12"},{"start":"2018-03","end":"2021-06"}] | "(not exposed by parser schema)" | MISS |
| us-resume.rtf | 0 | name | "Mira Example" | "(not exposed by parser schema)" | MISS |
| us-resume.rtf | 0 | email | "synthetic4@example.com" | "(not exposed by parser schema)" | MISS |
| us-resume.rtf | 0 | phone | "+995 555 00 00 04" | "(not exposed by parser schema)" | MISS |
| us-resume.rtf | 0 | city | "Boston" | "" | MISS |
| us-resume.rtf | 0 | roles | ["Senior Analyst — Fictional Labs","Analyst — Example Works"] | [] | MISS |
| us-resume.rtf | 0 | years | 5 | null | MISS |
| us-resume.rtf | 0 | education | ["Bachelor of Science — Fictional University"] | [] | MISS |
| us-resume.rtf | 0 | educationLevel | "bachelor" | null | MISS |
| us-resume.rtf | 0 | skills | ["SQL","Python","Tableau"] | [] | MISS |
| us-resume.rtf | 0 | languages | [{"name":"ინგლისური","level":"native"},{"name":"გერმანული","level":"b2"}] | [] | MISS |
| us-resume.rtf | 0 | certifications | ["AWS Certified Cloud Practitioner"] | "(not exposed by parser schema)" | MISS |
| us-resume.rtf | 0 | roleDates | [{"start":"2020-01","end":"2023-12"},{"start":"2018-03","end":"2021-06"}] | "(not exposed by parser schema)" | MISS |
| us-resume.odt | 0 | name | "Mira Example" | "(not exposed by parser schema)" | MISS |
| us-resume.odt | 0 | email | "synthetic4@example.com" | "(not exposed by parser schema)" | MISS |
| us-resume.odt | 0 | phone | "+995 555 00 00 04" | "(not exposed by parser schema)" | MISS |
| us-resume.odt | 0 | city | "Boston" | "" | MISS |
| us-resume.odt | 0 | roles | ["Senior Analyst — Fictional Labs","Analyst — Example Works"] | [] | MISS |
| us-resume.odt | 0 | years | 5 | null | MISS |
| us-resume.odt | 0 | education | ["Bachelor of Science — Fictional University"] | [] | MISS |
| us-resume.odt | 0 | educationLevel | "bachelor" | null | MISS |
| us-resume.odt | 0 | skills | ["SQL","Python","Tableau"] | [] | MISS |
| us-resume.odt | 0 | languages | [{"name":"ინგლისური","level":"native"},{"name":"გერმანული","level":"b2"}] | [] | MISS |
| us-resume.odt | 0 | certifications | ["AWS Certified Cloud Practitioner"] | "(not exposed by parser schema)" | MISS |
| us-resume.odt | 0 | roleDates | [{"start":"2020-01","end":"2023-12"},{"start":"2018-03","end":"2021-06"}] | "(not exposed by parser schema)" | MISS |

| field | correct | expected |
|---|---:|---:|
| name | 0 | 12 |
| email | 0 | 12 |
| phone | 0 | 12 |
| city | 6 | 12 |
| roles | 1 | 12 |
| years | 2 | 12 |
| education | 4 | 12 |
| educationLevel | 4 | 12 |
| skills | 3 | 12 |
| languages | 5 | 12 |
| certifications | 0 | 12 |
| roleDates | 0 | 12 |
| TOTAL | 25 | 144 |

| fixture | extract ms | parse ms | total ms |
|---|---:|---:|---:|
| europass-en.pdf | 1054.86 | 45.51 | 1100.37 |
| linkedin-export.pdf | 12.42 | 9.36 | 21.78 |
| two-column-canva.pdf | 7.78 | 0.83 | 8.6 |
| us-resume.pdf | 6.96 | 21.57 | 28.53 |
| hh-ru.pdf | 5.45 | 0.69 | 6.14 |
| georgian.pdf | 6.11 | 0.69 | 6.8 |
| georgian-acadnusx.txt | 0.02 | 0.19 | 0.21 |
| georgian-acadnusx.pdf | 5.62 | 0.46 | 6.08 |
| word-table.docx | 0.93 | 1.16 | 2.09 |
| scanned.pdf | 2.96 | 0.17 | 3.13 |
| us-resume.rtf | 0.02 | 0.1 | 0.12 |
| us-resume.odt | 0.01 | 0.08 | 0.09 |
```
