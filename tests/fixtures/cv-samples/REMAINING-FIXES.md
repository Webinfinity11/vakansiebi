# R3 remaining parser fixes

Status: **not done — verification pending; not built**. The isolated checkout
forbids installing dependencies, running tests or builds. `git diff --check`
exited 0 with no output. No running-app verification or candidate uploads were
performed, and there are no new candidate IDs, measured scores or timings.

Changes:

- `lib/server/cv-text.ts`: narrow PDF items with `Extract` so `fontName` exists;
  load the operator list on pages without Georgian Unicode before reading
  original font names from `commonObjs`;
  prioritize gutters that do not cut text over apparent gaps enlarged by
  excluding long column lines; apply the font-less fallback only to TXT.
- `lib/cv-legacy-georgian.ts`: require zero Georgian letters and two distinct,
  case-sensitive whole-word keywords; protect contacts/URLs from both detection
  and conversion; preserve tokens outside the legacy keyboard alphabet.
- `tests/cv-parse.test.ts`: regressions for mixed-font PDF, subset-prefixed names,
  wide main-column education, TXT contact preservation, English/Russian/chat
  false positives, repeated keywords and keywords hidden in contacts.
- `tests/cv-fixtures.test.ts`: ensure every non-legacy fixture's extracted text
  remains unchanged by the font-less rule. All score thresholds and expected
  results remain unchanged.

No new UI strings. No OCR, LLM or dependencies added. The legacy-font PDF
remains synthetic, not validation against a real historical font file. Font
metadata and the Canva output still need observation with the owner's pdfjs
runtime. Owner probe confirmed that styles report only `sans-serif`, while
`commonObjs` exposes `AcadNusx-Synthetic-FiraGO` only after `getOperatorList()`.
It also confirmed that the old gutter logic splits education from its body.
The updated extraction still needs the owner's regression run. Pages mixing
Unicode Georgian and legacy-font Georgian skip font recovery under this fast
path. TXT cannot reliably distinguish every English word from legacy
Georgian; the conservative document gate limits where conversion is applied.

After reviewing and integrating, the owner must run:

```sh
npx tsc --noEmit -p .
DATABASE_URL=postgresql://localhost:5432/jobx_company_local npx tsx --test --test-concurrency=1 tests/cv-fixtures.test.ts
DATABASE_URL=postgresql://localhost:5432/jobx_company_local RUN_COMPANY_DB_TESTS=1 npx tsx --test --test-concurrency=1 tests/cv-parse.test.ts tests/cv.test.ts tests/cv-upload.test.ts tests/company-cv-box.integration.test.ts tests/company-talent-filters.test.ts
```

Report the fixture AFTER scores, each file timing and all suite counts. Then
verify real multipart uploads at port 3270 with the demo account, using the
route's actual fields and synthetic names prefixed `სატესტო`: Europass,
LinkedIn, hh.ru, Georgian, DOCX table, plus ODT/RTF/TXT when accepted. Inspect
stored profiles via GET candidates; report candidate IDs and profiles. Do not
substitute production DATABASE_URL, restart servers or lower thresholds.
