# Vacancy details: conditions first, contact according to the posting

The primary flow is salary, location, work arrangement, explicit schedule, employer contact and the source description. Personal application tracking is a collapsed optional section below the description. Existing browser records remain intact.

- Schedule extraction preserves explicit source wording, including days, hours and separate shifts. It reads published description and labelled facts, without inferring a 9–6 schedule from “full-time”. Missing schedules are labelled as unspecified.
- Georgian phone numbers in the vacancy text require contact context (or an explicit +995 prefix), are normalized and deduplicated. Salary figures and labelled IDs are excluded. Valid `tel:` links inside the vacancy description survive text extraction. Site-wide support numbers and hidden account/profile fields are not imported.
- SS.ge's publicly displayed `conditions` field is now included in the description, along with description, duties and requirements. Existing postings acquire it on their normal source recheck; two real SS postings were checked through the standard quality-guarded importer during verification.
- A single explicit recruitment email produces a `mailto:` draft with the vacancy title. A single labelled application link opens that form. Multiple email/phone options are shown for the visitor to choose. Generic contact emails are not described as CV submission addresses; privacy and no-reply addresses are excluded from this contact panel.
- With no extracted contacts or explicit application link, the action remains the source posting. Masked source contacts are not guessed or replaced with a company-wide number.
- Sending is performed in the visitor's mail application, with CV attached there. The site does not upload a CV, send mail or require a visitor account. The action does not automatically mark an application as submitted.

Validation includes source parser/contact/schedule tests, the isolated PostgreSQL suite, typecheck/lint/build, and browser checks using real public postings: two phone numbers, two shifts, email recipient and subject, collapsed personal tracking, desktop and mobile layout. Browser checks inspect mailto/tel destinations without launching them or sending messages.
