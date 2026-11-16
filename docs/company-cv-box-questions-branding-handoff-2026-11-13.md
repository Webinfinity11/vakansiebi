# CV ყუთი, მოკლე კითხვარი და კომპანიის ბრენდინგი

იზოლირებული სამუშაო ასლი: C035BF08-256D-423D-92D2-5D62DEA42FA6.

მომხმარებლის მოთხოვნა: „და hr ზე მიყევი და კონკრეტენბს რაც აქვთ ყყველაფერი გვინდა მთავაირია სწორად და პრაქტიკულად იყოს“.
ამ ნაკადის ფარგლებია კვლევის #4 CV ყუთი, #5 კითხვარი და #9 ბრენდინგი.

## განხორციელება და შემოწმების სტატუსი

1. **CV ყუთი — not done (გაშვებულ აპში შემოწმება).** კოდი დაწერილია: საჯარო კომპანიის გვერდზე PDF/DOCX ან ადგილობრივი JOBX რეზიუმე, მკაფიო თანხმობა; profile.cv_box_enabled ნაგულისხმევად false. მხოლოდ approved კომპანია, ჩართული/დადასტურებული პორტალის ანგარიში, შეცვლილი დროებითი პაროლი და ჩართული პორტალი. იგივე პირობები მოწმდება POST-ისას და ჩანაწერის ტრანზაქციაში. company_cv_uploads: source=cv_box, job_id=NULL, consent_at, client_hash; ფაილები მაქსიმუმ 5 მბ. არსებული CV-ის წაკითხვისა და ტექსტის ამოკითხვის ნაკადი. CV ყუთისთვის ფაილი კერძო PostgreSQL bytea-ში ინახება (Blob-ზე არ იგზავნება). წყაროს ნიშანი და ფილტრი პანელში. დუბლიკატი: ფაილის hash ან ამ კომპანიის CV ყუთში იგივე ელფოსტა. მინუტური ლიმიტი 5/კლიენტი, გაზიარებული ტრანზაქციული დღიური ლიმიტი 10/კლიენტი.
2. **კითხვარი — not done (გაშვებულ აპში შემოწმება).** ცალკე რედაქტორი; 0–5 კითხვა, კი/არა, ერთი არჩევანი (2–8 ვარიანტი), მოკლე ტექსტი. სურვილისამებრ სასურველი პასუხი, რომელიც საჯარო GET-ში არ გადის. ვაკანსიის create/save/restore ტრანზაქციაში შენახვა. საჯარო ფორმაში ყველა დამატებულ კითხვაზე პასუხი აუცილებელია; სერვერიც ამოწმებს. განაცხადი ინახავს კითხვის, პასუხის და სასურველი პასუხის სნეპშოტს. კანდიდატის ბარათზე „პასუხები“, სიაში/დაფაზე/ბაზაში ნიშანი და ფილტრი „ემთხვევა მოთხოვნებს“. სასურველი პასუხის არქონა = შესაბამისობის ნიშნის არქონა. მოკლე ტექსტი შედარდება ზუსტად, გარე ჰარებისა და ასოების რეგისტრის უგულებელყოფით. ავტომატური უარი არ არის. swipe-დან კითხვარიან ვაკანსიაზე გაგზავნა პასუხების გარეშე 422-ს აბრუნებს და კანდიდატი ვაკანსიის საჯარო განაცხადზე გადადის; გაგზავნილად არ აღინიშნება.
3. **ბრენდინგი — not done (გაშვებულ აპში შემოწმება).** ქავერის უსაფრთხო ატვირთვა (JPG/PNG/WebP, 4 მბ, 24 მეგაპიქსელის ზღვარი, ერთი კადრი, metadata-ს მოცილება, WebP 1600×600-მდე/2 მბ), მხოლოდ owner-ისთვის. ფაილი ამ კომპანიის პროფილზე უნდა იყოს ატვირთული; დაუშენახავი სურათი საჯარო API-ში არ ჩანს. ბენეფიტები (12-მდე, 120 სიმბოლო თითო), „რატომ ჩვენთან“ (1500 სიმბოლო), პროფილში რედაქტირება და საჯარო გვერდზე ჩვენება. ბრენდის ფერი არ დამატებულა. გვერდის შექმნის/გაქრობის/SEO index/noindex წესი არ შეცვლილა.

**not built.** იზოლირებული სამუშაო ასლის წესის შესაბამისად არ გაშვებულა build, typecheck, unit/integration ტესტები ან dev server. ამ კოდს 3200-ის სერვერი არ ემსახურება. არც ერთი ფუნქცია არ არის „verified in the running app“ ან „verified by tests only“. მხოლოდ ფორმატირება (`oxfmt`) და `git diff --check` შესრულდა. production DB, demo მონაცემები, commit/push/deploy არ შეცვლილა.

## ინტეგრაციის მნიშვნელოვანი ადგილები

- owner-ის SEO შესწორება: `app/companies/[slug]/page.tsx`-ის `generateMetadata` title გრძელი კომპანიის სახელისთვის `| ჯობიქსი`-ს აღარ ამატებს. ჩემი diff metadata-ს არ ეხება; owner-ის ეს ხაზი შეინარჩუნეთ.

- `portal.tsx`: მხოლოდ ახალი კომპონენტის import და `<ProfileBranding .../>`.
- `job-editor.tsx`: მხოლოდ import და `<JobQuestions .../>`.
- `lib/server/job-submissions.ts`, `lib/server/jobs.ts`: owner-ის optional questions და ტრანზაქციაში `saveJobQuestions`. გადახდის ნაკადის ცვლილებები შეინარჩუნეთ. გადახდის worker-ის დაზუსტება: მის `company-jobs.ts`-ში save/restore იყენებს `mutateJob`-ის მესამე `afterSave` callback-ს ინვოისის ატომურად შესაქმნელად. ამ ნაკადში კითხვარი უშუალოდ `mutateJob`-ის ტრანზაქციაში ინახება, ამიტომ callback-ს არ ცვლის; ინტეგრაციისას მესამე არგუმენტი/signature და მისი გამოძახება აუცილებლად შეინარჩუნეთ. თუ კითხვარის შენახვას callback-ში გადაიტანთ, ორივე helper ერთ callback-ში უნდა გაეშვას, ერთმა მეორის გადაწერის გარეშე.
- `lib/server/swipe-apply.ts`: ამ ასლში email-only ძველი ნაკადია. მთავარ ასლში არსებული portal consent/storage ცვლილებები აუცილებლად შეინარჩუნეთ; გადაიტანეთ მხოლოდ answers-ის წაკითხვა, კითხვარის ვალიდაცია და question_answers INSERT.
- `app/swipe/swipe-deck.tsx`: 422-ზე საჯარო განაცხადზე გადასვლის პატარა დამატება. მთავარ ასლში სხვა swipe ცვლილებები არ დაიკარგოს.
- პორტალის როლების სხვა ნაკადმა `app/api/company/profile/route.ts`-ის დაცვა უნდა შეინარჩუნოს. ახალი cover POST უკვე owner-ს მოითხოვს.

## owner-ის შემოწმება ინტეგრაციის შემდეგ

1. მიგრაციები მხოლოდ ლოკალურზე: `DATABASE_URL=postgresql://localhost:5432/jobx_company_local npm run db:migrate` (079/080).
2. `npx tsc --noEmit -p .`; `.next/`-ის ძველი შეცდომები ცალკე აღრიცხეთ.
3. `npx tsx --test tests/job-questions.test.ts tests/cv-upload.test.ts tests/company-branding.test.ts`.
4. ლოკალური opt-in ტესტი, რომელიც საკუთარ QA კომპანიას ქმნის და ბოლოს შლის: `DATABASE_URL=postgresql://localhost:5432/jobx_company_local RUN_COMPANY_DB_TESTS=1 npx tsx --test tests/company-cv-box.integration.test.ts`. ტესტს აქვს localhost + ზუსტი DB სახელის დაცვა. ამოწმებს თანხმობას, მიმღები ანგარიშის არსებობას, გამორთვას, ყალბ DOCX-ს, დუბლიკატს, private CV წაკითხვას, ამოკითხულ ტექსტს და სხვა კომპანიის წვდომის უარყოფას.
5. შესაბამისი ძველი swipe/application/company-candidate ტესტები და ერთი ფართო რეგრესია (ძველი DB ტესტის `ertad_test` დაცვა არ მოაშოროთ).
6. გაშვებულ აპში 1440/390 სიგანეზე: საჯარო კომპანიის გვერდი და უცვლელი SEO noindex; პროფილის ქავერი/წაშლა/რატომ ჩვენთან/ბენეფიტები/CV ყუთის გადამრთველი; PDF, DOCX და JOBX CV, თანხმობის გარეშე უარი, 5 მბ ზღვარი, დუბლიკატი და გამორთული ყუთი; კერძო ბაზაში „CV ყუთი“, ამოკითხვა/ფაილის წაკითხვა; 0/5/6 კითხვა, ტიპები/არჩევანი/გახსნა ხელახალი რედაქტირებისთვის; სწორი და განსხვავებული პასუხები/ფილტრი/სნეპშოტის უცვლელობა; swipe-ის გადასვლა კითხვარიან განაცხადზე და ჩვეულებრივი swipe გაგზავნა.
7. გადაამოწმეთ მონაცემების აღდგენა და screenshot-ები; ეს ნაკადი სადემო მონაცემებს არ შეხებია.

## ფაილები
- `app/api/applications/questions/route.ts`
- `app/api/companies/cv-box/route.ts`
- `app/api/company-covers/[hash]/route.ts`
- `app/api/company/profile/cover/route.ts`
- `app/application-questions.tsx`
- `app/companies/[slug]/company.css`
- `app/companies/[slug]/cv-box.tsx`
- `app/companies/[slug]/page.tsx`
- `app/company/branding.css`
- `app/company/candidate-answers.tsx`
- `app/company/candidates-view.tsx`
- `app/company/company-api.ts`
- `app/company/job-editor.tsx`
- `app/company/job-questions.tsx`
- `app/company/portal.tsx`
- `app/company/profile-branding.tsx`
- `app/company/talent-view.tsx`
- `app/swipe/swipe-deck.tsx`
- `app/vacancy-application-form.tsx`
- `db/migrations/079_job_questions.sql`
- `db/migrations/080_company_branding.sql`
- `docs/company-cv-box-questions-branding-handoff-2026-11-13.md`
- `lib/company-candidates.ts`
- `lib/company-job-form.ts`
- `lib/cv-upload.ts`
- `lib/job-questions.ts`
- `lib/server/companies.ts`
- `lib/server/company-candidates.ts`
- `lib/server/company-covers.ts`
- `lib/server/company-cv-box.ts`
- `lib/server/company-jobs.ts`
- `lib/server/job-questions.ts`
- `lib/server/job-submissions.ts`
- `lib/server/jobs.ts`
- `lib/server/swipe-apply.ts`
- `tests/company-branding.test.ts`
- `tests/company-cv-box.integration.test.ts`
- `tests/cv-upload.test.ts`
- `tests/job-questions.test.ts`
