# Google-ით შესვლა კომპანიებისთვის — გეგმა

სტატუსი (2026-11-16): კოდი მზადაა და ლოკალურად შემოწმებულია. ნამდვილ Google ანგარიშზე
შემოწმება ელოდება Google-ის გასაღებებს. დაფაზე: T15.7.

## როგორ მუშაობს

1. `/company` გვერდზე, შესვლისა და რეგისტრაციის ფორმის თავში, ჩანს ღილაკი
   „Google-ით შესვლა“ (რეგისტრაციის ჩანართზე — „Google-ით რეგისტრაცია“).
2. ღილაკი გადაჰყავს Google-ზე (`/api/company/google/start`), იქ ადამიანი ანგარიშს
   ირჩევს და ბრუნდება `/api/company/google/callback`-ზე.
3. თუ ეს Google ანგარიში ან მისი ელფოსტა უკვე რეგისტრირებულია, ადამიანი პირდაპირ
   შედის კომპანიის სივრცეში. ელფოსტა ავტომატურად დადასტურებულად ითვლება.
4. თუ ანგარიში არ არსებობს, იხსნება რეგისტრაციის ფორმა: სახელი და ელფოსტა
   Google-იდან ივსება, პაროლი არ სჭირდება. რჩება კომპანიის დასახელება,
   საიდენტიფიკაციო კოდი, თანამდებობა და ტელეფონი.
5. ახალი კომპანია, როგორც აქამდე, ადმინისტრატორის შემოწმებას გადის.

დაცვა:
- გამოიყენება authorization code + PKCE, state და nonce;
- მიიღება მხოლოდ Google-ის დადასტურებული ელფოსტა;
- ერთხელ მიბმულ ელფოსტას სხვა Google ანგარიში ვეღარ დაისაკუთრებს;
- გათიშული ანგარიში ვერ შედის.

## ნაბიჯები

### 1. Google OAuth კლიენტის შექმნა — შენ

1. [Google Cloud Console](https://console.cloud.google.com/) → აირჩიე ან შექმენი პროექტი
   (მაგ. „JOBX“).
2. APIs & Services → OAuth consent screen:
   - User type: **External**;
   - App name: **JOBX**, support email, ლოგო;
   - Authorized domain: `jobx.ge`;
   - Scopes: `openid`, `email`, `profile` (სხვა არაფერი);
   - Privacy policy და Terms ბმულები საიტიდან;
   - გამოაქვეყნე (**Publish app**), თორემ მხოლოდ სატესტო მომხმარებლები შეძლებენ შესვლას.
3. APIs & Services → Credentials → **Create credentials → OAuth client ID**:
   - Application type: **Web application**;
   - Authorized redirect URIs:
     - `http://127.0.0.1:3200/api/company/google/callback`
     - `https://jobx.ge/api/company/google/callback`
4. შეინახე Client ID და Client secret. საიდუმლო გასაღები ჩატში არ გამოგზავნო.

### 2. ლოკალური გაშვება — შენ, მერე მე

1. `.env.local`-ში ჩაწერე:
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   ```
2. მე გადავტვირთავ ლოკალურ სერვერს, რომ ახალი პარამეტრები წაიკითხოს.

### 3. ლოკალური შემოწმება — მე, შენს თვალწინ ბრაუზერში

- [ ] ღილაკი ჩანს შესვლისა და რეგისტრაციის ჩანართებზე.
- [ ] ახალი Google ანგარიში → რეგისტრაციის ფორმა წინასწარ შევსებული → კომპანია
      იქმნება „შემოწმების მოლოდინში“ სტატუსით.
- [ ] გასვლა და ხელახლა „Google-ით შესვლა“ → პირდაპირ კომპანიის სივრცე.
- [ ] არსებული (პაროლიანი) ანგარიშის ელფოსტით Google-ით შესვლა → იგივე ანგარიში.
- [ ] Google-ის ფანჯარაში „Cancel“ → დაბრუნება შესვლის გვერდზე შეცდომის გარეშე.
- [ ] ტელეფონის ზომაზე ღილაკი და ფორმა სწორად ჩანს.
- [ ] სატესტო ანგარიშების წაშლა ლოკალური ბაზიდან.

### 4. გაშვება საიტზე — შენი გადაწყვეტილებით

1. production ბაზაზე მიგრაციები კოდის გაშვებამდე: 076–081 (ბიზნესის ანგარიშები)
   და **082_company_google_sign_in.sql**.
2. Vercel → Environment Variables (Production): `GOOGLE_CLIENT_ID`,
   `GOOGLE_CLIENT_SECRET`. ასევე უნდა არსებობდეს `COMPANY_PORTAL_ENABLED=true`
   და `APP_URL=https://jobx.ge`.
3. commit და push `main`-ზე; deploy GitHub Actions-ით მოხდება
   (`vercel --prod` ცალკე არ გაეშვას).
4. საიტზე შემოწმება: `https://jobx.ge/company` → Google-ით შესვლა საკუთარი ანგარიშით.

## ცნობილი შეზღუდვები

- Google-ით დარეგისტრირებულ ანგარიშს პაროლი არ აქვს და ის Google-ით შედის.
  საჭიროების შემთხვევაში ადმინს შეუძლია პაროლის აღდგენა.
- გუნდში მოწვევით (invite) შესვლა ჯერ მხოლოდ პაროლით ხდება.
- კომპანიის სივრცის ინტერფეისი მხოლოდ ქართულადაა.

## ფაილები

- `db/migrations/082_company_google_sign_in.sql` — ველი `google_sub`
- `lib/server/company-google.ts` — Google-ის ნაკადი და დაცვის შემოწმებები
- `app/api/company/google/start/route.ts`, `app/api/company/google/callback/route.ts`,
  `app/api/company/google/route.ts`
- `lib/server/company-accounts.ts`, `app/api/company/register/route.ts` — რეგისტრაცია Google-ით
- `app/company/portal.tsx`, `app/company/portal.css`, `app/company/page.tsx` — ღილაკი და ფორმა
- `tests/company-google.test.ts` — ტესტები
