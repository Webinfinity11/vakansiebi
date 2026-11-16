# შეტყობინებები, უარყოფის მიზეზი, სწრაფი მოდერაცია, სანდო კომპანიები — გეგმა

2026-11-16. სამი ბლოკი: A (HR-ის შეტყობინებები), B (უარყოფის მიზეზი და სწრაფი
მოდერაცია), C (ადმინის შეტყობინება და სანდო კომპანიები). ხარჯი არ ემატება.

## რა არსებობს უკვე

- **დაგეგმილი გაშვება არსებობს.** `vercel.json` → `/api/cron/invoice-email`
  ყოველ საათში 07:17–23:17 (თბილისი), `CRON_SECRET`-ით დაცული. ის უკვე აგზავნის
  ინვოისის, გამოქვეყნებისა და ამოღების წერილებს. ახალი სამუშაო ამავე route-ს
  ემატება, ამიტომ **`vercel.json` და production-ის cron კონფიგურაცია არ იცვლება**.
- წერილები: Resend პირდაპირ `fetch`-ით, რიგი ცხრილში (ნიმუში:
  `lib/server/publication-email.ts` + `publication_email_delivery`), განლაგება
  `lib/email-layout.ts`.
- განაცხადის სამი წყარო: `swipe_applications` (status='sent'; საჯარო ფორმაც ამას
  იყენებს), `resume_contacts` (kind='cv'), `company_cv_uploads` (source='cv_box').
  Swipe განაცხადი დამსაქმებელს უკვე უგზავნის CV-ის ასლს ვაკანსიის ელფოსტაზე;
  ახალი შეტყობინება ანგარიშის მფლობელს მიდის და მხოლოდ რაოდენობას შეიცავს.
- მოდერაცია: `mutateJob` (`lib/server/jobs.ts`), მესამე არგუმენტი `afterSave`
  იმავე ტრანზაქციაში. უარყოფის მიზეზი ამ callback-ით ინახება, ამიტომ
  `lib/server/jobs.ts` **არ იცვლება**.
- ბოლო მიგრაცია: 085. ახალი: **086** (ერთი ფაილი სამივე ბლოკისთვის).

## მიგრაცია `db/migrations/086_notifications_moderation.sql`

```sql
-- საერთო რიგი ყველა ახალი წერილისთვის; dedupe_key გამორიცხავს გამეორებას.
CREATE TABLE notification_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('applications','deadline','candidate_ack','job_rejected','admin_review')),
  dedupe_key text NOT NULL UNIQUE,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sending','sent','failed','cancelled')),
  attempts int NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz,
  provider_id text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);
CREATE INDEX notification_emails_due ON notification_emails(next_attempt_at) WHERE status IN ('pending','sending');

CREATE TABLE company_notification_settings (
  company_key text PRIMARY KEY REFERENCES company_profiles(company_key) ON DELETE CASCADE,
  application_mode text NOT NULL DEFAULT 'digest' CHECK (application_mode IN ('instant','digest','off')),
  deadline_reminders boolean NOT NULL DEFAULT true,
  auto_reply boolean NOT NULL DEFAULT false,
  auto_reply_template text NOT NULL DEFAULT 'received' CHECK (auto_reply_template IN ('received','interview','information','rejected','accepted')),
  applications_seen_until timestamptz NOT NULL DEFAULT now(),
  auto_reply_since timestamptz,
  last_digest_on date,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO company_notification_settings(company_key) SELECT company_key FROM company_profiles;

-- B: ბოლო უარყოფის მიზეზი თითო ვაკანსიაზე.
CREATE TABLE job_rejections (
  job_id uuid PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('incomplete','no_contact','duplicate','rules','other')),
  note text NOT NULL DEFAULT '' CHECK (length(note) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (reason <> 'other' OR length(btrim(note)) > 0)
);

-- C: სანდო კომპანია და ავტომატური გამოქვეყნების ნიშანი.
ALTER TABLE company_profiles ADD COLUMN trusted_mode text NOT NULL DEFAULT 'auto' CHECK (trusted_mode IN ('auto','on','off'));
ALTER TABLE jobs ADD COLUMN auto_published_at timestamptz, ADD COLUMN auto_publish_reviewed_at timestamptz;
CREATE INDEX jobs_auto_publish_review ON jobs(auto_published_at) WHERE auto_published_at IS NOT NULL AND auto_publish_reviewed_at IS NULL;

CREATE TABLE notification_state (key text PRIMARY KEY, value jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());
```

## საერთო საფუძველი (ბლოკი A-ს მუშა წერს პირველად)

- `lib/server/notification-email.ts`
  - `notificationEmailEnabled()` = `!!RESEND_API_KEY && NOTIFICATION_EMAIL_ENABLED !== 'false'`.
  - `queueNotification(client, { kind, dedupeKey, payload })` → `INSERT … ON CONFLICT(dedupe_key) DO NOTHING`, აბრუნებს boolean-ს.
  - `deliverNotifications(limit = 10)` — `publication-email.ts`-ის ლოგიკა (lease, `Idempotency-Key: jobx-notification/<id>`, backoff, 6 ცდა). production-ის გარეთ მიმღები იცვლება `delivered@resend.dev`-ით (როგორც `swipeRecipient`). Resend-ის გარეშე: `{ disabled: true }`, სტრიქონები pending რჩება.
- `lib/notification-emails.ts` — სუფთა ფუნქციები, რომლებიც აბრუნებს `InvoiceEmail` payload-ს (`emailLayout`, `emailButton`); ტელეფონის ნომერი არსად.
- `lib/server/notification-jobs.ts` — `runNotificationJobs(now = new Date())`: რიგში ჩაყრა (A1, A2, A3, C6), შემდეგ `deliverNotifications`. იძახება `app/api/cron/invoice-email/route.ts`-დან (ერთი დამატებული გამოძახება, შეცდომა სხვა წერილებს არ აჩერებს).
- ლოკალური გაშვება და preview: `scripts/notification-preview.ts` (`npx tsx`) რიგს ავსებს და თითო წერილის HTML-ს წერს `/tmp/jobx-notifications/`-ში. ლოკალურად cron endpoint: `curl -H "Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3270/api/cron/invoice-email`.

## A. HR-ის შეტყობინებები

1. **ახალი განაცხადი.** მიმღები: კომპანიის მფლობელის ანგარიში (enabled, email_verified).
   Hook-ები განაცხადის კოდში არ ემატება: `runNotificationJobs` სამივე წყაროს ეკითხება
   `applications_seen_until`-ის შემდეგ. `instant` — ყოველ გაშვებაზე (საათში ერთხელ)
   თითო წერილი კომპანიაზე; `digest` — დღეში ერთხელ, 09:00-ის (თბილისი) შემდეგ პირველ
   გაშვებაზე (`last_digest_on`); `off` — მხოლოდ watermark მიიწევს. წერილში: ვაკანსიების
   სათაურები, თითოზე რაოდენობა, ბმული `/company?…` კანდიდატებზე. კანდიდატის სახელი და
   კონტაქტი არ იწერება. `instant` რეჟიმის დასაჩქარებლად `/api/swipe/apply`,
   `/api/companies/cv-box` და `/api/resumes/contact` route-ები წარმატების შემდეგ
   `after()`-ით იძახებს იმავე ფუნქციას ერთი კომპანიისთვის (best effort).
2. **ვადის შეხსენება.** გამოქვეყნებული, კომპანიის საკუთრებაში მყოფი ვაკანსია, რომლის
   `deadline` დღეიდან 3 დღეშია. dedupe: `deadline:<job>:<deadline>`. ბმული:
   `/company/jobs/<id>/extend` — კაბინეტის გვერდი ერთი ღილაკით „ვადის გაგრძელება 30 დღით“
   (POST; წერილის ბმული თავად არაფერს ცვლის, რომ ფოსტის სკანერმა ვადა არ გააგრძელოს).
   სერვერი: `lib/server/job-deadline.ts` `extendJobDeadline(company, jobId)` — მხოლოდ
   `status='published'`, `needs_review=false`, ვადა ≤ დღეს+7; ახალი ვადა =
   max(დღეს, ვადა)+30, არაუმეტეს დღეს+90 (ფორმის ზღვარი); იცვლება `draft` და `published`,
   `version+1`, audit `deadline.extended`, `clearPublicJobsCache()`. თუ პირობა არ სრულდება,
   გვერდი აჩვენებს ბმულს `/company/jobs/<id>/edit`-ზე. ფასიან განთავსებას არ ეხება.
   API: `app/api/company/jobs/extend/route.ts` (owner, recruiter).
3. **„განაცხადი მიღებულია“.** `auto_reply=true`-ისას, ჩართვის მომენტიდან
   (`auto_reply_since`) მოსულ განაცხადებზე, რომლებსაც ელფოსტა აქვს: `candidate_ack`,
   dedupe `ack:<company>:<entry>`. ტექსტი: კომპანიის შაბლონი (`render` —
   `lib/company-message-templates.ts`), ნაგულისხმევად `received`. კანდიდატთან „შენ“ ფორმა
   JOBX-ის ჩარჩოში; შაბლონის ტექსტი კომპანიისაა.
   პარამეტრები: `GET/POST app/api/company/notifications/route.ts` (ცვლის owner),
   UI: `app/company/notification-settings.tsx` ანგარიშის პარამეტრებში.

## B. უარყოფის მიზეზი და სწრაფი მოდერაცია

4. `lib/job-rejection.ts` — მიზეზების კოდები და ქართული ტექსტები: არასრული აღწერა;
   საკონტაქტო ინფორმაცია არ არის; დუბლიკატი; წესების დარღვევა; სხვა (+ ტექსტი).
   `app/admin/panel.tsx`: „დადასტურებას ელოდება“ რიგის სტრიქონზე „დამტკიცება“ და
   „უარყოფა“ (მიზეზის მენიუ).
5. `app/api/admin/jobs/route.ts`: `action='reject'`-ზე კითხულობს `reason`, `note`-ს და
   `mutateJob`-ის `afterSave`-ით წერს `job_rejections`-ში და რიგში აგდებს წერილს
   (`job_rejected`, მიმღები `job_submissions.notification_email`, არა ტესტზე).
   `lib/server/company-jobs.ts` `companyJobs` აბრუნებს `rejection`-ს;
   `app/company/jobs-view.tsx` უარყოფილ ვაკანსიაზე აჩვენებს მიზეზს და ბმულს
   „გასწორება და ხელახლა გაგზავნა“ → `/company/jobs/<id>/edit`.

## C. ადმინის შეტყობინება და სანდო კომპანიები

6. `ADMIN_NOTIFY_EMAIL` (არ არის → გამორთული). ყოველ გაშვებაზე: რამდენი ახალი
   არასატესტო ვაკანსია და კომპანიის ანგარიში ელოდება შემოწმებას ბოლო წერილის შემდეგ,
   და რამდენი ავტომატურად გამოქვეყნებული ვაკანსიაა გადასახედი. ახალი რომ არის, იგზავნება
   შეჯამება; დღეში არაუმეტეს `ADMIN_NOTIFY_DAILY_LIMIT` (ნაგულისხმევად 4).
   მდგომარეობა: `notification_state['admin_review']`.
7. `lib/server/trusted-companies.ts` — `companyTrusted(client, companyKey)`:
   `trusted_mode='on'` → კი; `'off'` → არა; `'auto'` → ბოლო 90 დღეში ≥3 გამოქვეყნებული
   საკუთარი განცხადება (job_submissions, არასატესტო) და 0 `reject` audit ჩანაწერი.
   დამატებით: კომპანია `approved`, მფლობელის ელფოსტა დადასტურებული.
   `changeCompanyJob` `create`: სანდო კომპანიის **სტანდარტული** განთავსება `submitJob`-ის
   შემდეგ ქვეყნდება `mutateJob({action:'publish'})`-ით და ინიშნება `auto_published_at`
   (audit `auto_publish`). VIP/Premium და რედაქტირება ძველებურად რიგში დგება; billing
   უცვლელია. ავტოგამოქვეყნების შეცდომა განცხადებას არ აფუჭებს — ის რიგში რჩება.
   ადმინი: სია „ავტომატურად გამოქვეყნდა — გადახედეთ“ + „გადახედილია“
   (`auto_publish_reviewed_at`); `app/admin/company-accounts/accounts.tsx`-ში კომპანიაზე
   არჩევანი: ავტომატური / ყოველთვის სანდო / არასოდეს.

## რა სჭირდება production-ს

- მიგრაცია 086 Neon-ზე (ადამიანის დასტურით, deploy-ის წინ).
- env: `ADMIN_NOTIFY_EMAIL` (სურვილისამებრ `ADMIN_NOTIFY_DAILY_LIMIT`,
  `NOTIFICATION_EMAIL_ENABLED=false` გასათიშად). `RESEND_API_KEY`, `CRON_SECRET`,
  `APP_URL` უკვე არსებობს.
- cron: ცვლილება არ არის საჭირო.

## შეზღუდვები

- „ყოველ განაცხადზე“ რეჟიმი ღამით (23:17–07:17) cron-ზე არ არის დამოკიდებული მხოლოდ
  `after()` გამოძახების წყალობით; თუ ის ვერ შესრულდა, წერილი დილის პირველ გაშვებაზე მიდის.
- ლოკალურად Resend არ არის: წერილები მოწმდება HTML preview-ით, რეალური გაგზავნა არა.
