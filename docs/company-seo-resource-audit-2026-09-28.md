# Company pages and resource audit — 2026-09-28

Changes are local and have not been deployed.

## Vacancy counts

The directory counted raw job IDs; employer pages use the public search plan,
which groups duplicate vacancies and applies visibility rules. The directory now
counts distinct public grouping keys within each employer's IDs, in one shared
query, with a one-minute directory cache. Live database read-only comparisons:

| Employer | Raw IDs | Corrected card | Employer page |
| --- | ---: | ---: | ---: |
| საქართველოს ბანკი | 74 | 57 | 57 |
| თიბისი | 355 | 248 | 248 |
| ბიბლუსი | 52 | 16 | 16 |

Independent requests can still differ briefly as jobs change and caches refresh.

## Company descriptions

Existing profile descriptions now have a visible short summary and an expandable
full version. Three reviewed defaults were prepared for TBC, Bank of Georgia and
Biblusi; saved profile values take precedence. No bulk description generation or
database writes were performed. The user explicitly limited further description
work to existing information from profiles/vacancies.

Official sources:
- https://tbcbank.ge/ka
- https://bankofgeorgia.ge/blog/shetavazebebi/biznes-shetavazebebi/gaxsenit-saqartvelos-bankis-biznes-angarishi-31-dekembramde-da-isargeblet-gansakutrebuli-shetavazebit/
- https://biblusi.ge/about

## Logos

The first 18 directory logos are present initially. Later logos acquire image
elements near the viewport, while every company link stays in the server HTML.
Failed logos retain a fallback instead of removing the company card. A browser
check with external images deliberately blocked retained all 637 company links.
This reduces resource requests; it does not repair or guarantee access to remote
image servers. Two reported failing samples (CloudFront and static.ss.ge)
returned HTTP 200 during this check.

## JobPosting

Four production pages returned HTTP 200 with parseable JobPosting JSON-LD,
self-referencing canonical URLs, titles matching H1, publication dates and future
expiration dates, employer names and Georgian locations. Two included salary
data. Samples:
- /vacancies/molare-konsultanti-15ac861a-6b90-4731-b9e7-22a6870f09f4
- /vacancies/gantskhadebis-dasakheleba-gaqidvebis-koltsentris-operatori-486802a6-7681-41a9-869f-89bca638b01a
- /vacancies/konsultanti-9e302a86-1c08-4023-b300-665c4fbe3451
- /vacancies/inventarizatsiisa-da-shekvetebis-spetsialisti-b5472756-a08c-43f1-8824-6ddf39d6d6da

The first sample named only “მარკეტი”. The generic-employer guard incorrectly
checked a key after the logo normalizer had already erased generic names.
It now checks the normalized identity directly; exact generic market names were
added. Such postings remain visible but no longer emit misleading JobPosting
markup. This fix is not yet deployed.

Google Rich Results Test was attempted for the Biblusi sample. It returned
“Something went wrong / Log in and try again”, so there is no Google validation
result. Local HTML inspection is not a replacement for that verdict.

## Validation

- 27 targeted tests passed; TypeScript and lint checks passed.
- Desktop/mobile browser checks: filters, zero-result state, title, description,
  no horizontal overflow at 390px, no observed runtime errors.
- SSR test: 80 company links retained with 18 initial external logo images.
