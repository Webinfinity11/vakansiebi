# R3 D1–D2 implementation handoff

Status: **not done — verification pending**, **not built**. This isolated workspace explicitly forbids dependency installs, tests and builds. `git diff --check` passed with no output. No app verification, TypeScript check, test counts or new timings are available. Do not interpret this code handoff as meeting acceptance.

## Scores

| Group | Before (11 text-bearing fixtures) | After |
| --- | ---: | --- |
| Existing seven groups | 25/77 | Not run |
| name | 0/11 | Not run |
| email | 0/11 | Not run |
| phone | 0/11 | Not run |
| certifications | 0/11 | Not run |
| positions/date pairs | 0/11 | Not run |

`tests/cv-fixtures.test.ts` prints every field match, the totals and per-file elapsed milliseconds before asserting thresholds (65/77; contacts 10/11 each; certifications and date pairs provisional 9/11 each). The latter thresholds are proposed, not measured achievements. It also fails every regression from the checked-in `results.json` OK cells. It does not overwrite that baseline.

Comparison normalizes expected phone punctuation using candidatePhone, current to present, and LinkedIn Full Professional to c1, as required by the new contract. No fixtures or expected.json were altered.

The checked-in legacy PDF still uses FiraGO without a legacy name. The generator now repairs this fixture with a **synthetic** `AcadNusx-Synthetic-FiraGO` font name on only originally Georgian runs. Email and Latin skill runs retain normal FiraGO. This is NOT a real legacy font: it tests name detection plus the mapping only, not real legacy glyph encodings. Binary regeneration awaits the owner checkout (command below); no fixture expectation was changed.

The TXT has no font metadata and remains Latin under the explicit font-only conversion requirement. No keyword heuristic or threshold reduction was added. Once the PDF is regenerated, the unchanged 10/11 contact threshold can tolerate this one missing Georgian name; actual results still need measurement.

pdf-lib's `customName` option is documented at https://pdf-lib.js.org/docs/api/interfaces/embedfontoptions .

## Changed files

- `lib/server/cv-text.ts`: PDF gutter detection and reading bands, repeated footer/page-number removal, font metadata and legacy conversion; DOCX headers/footers/tables/textboxes; ODT, RTF, UTF-8 TXT; extraction reasons; compatibility wrapper.
- `lib/cv-legacy-georgian.ts`: font-gated mapping table.
- `lib/cv-parse.ts`: sections, dates, contacts, positions, certifications, confidence, language levels, skill aliases and foreign-city fallback.
- `lib/company-candidates.ts`: additive optional profile fields only.
- `lib/cv-upload.ts`: shared 4 MiB limit, ODT/RTF/TXT content checks.
- `lib/server/company-candidates.ts`: only upload types, sniffing and size/messages.
- `app/api/company/candidates/upload/route.ts`: request-size check and size message only; no Next APIs changed. The Next docs directory is absent in this snapshot.
- `tests/cv-parse.test.ts`, `tests/cv-upload.test.ts`: additional regression cases.
- `tests/cv-fixtures.test.ts`: scored corpus regression test.
- `tests/fixtures/cv-samples/generate.ts`: isolated --legacy-only regeneration and correctly tagged mixed-font synthetic PDF.
- This handoff document.

## Exports and data

New `legacyGeorgian(text: string, font: string): string`.
New `isOdt(bytes: Buffer): boolean`, `isRtf(bytes: Buffer): boolean`, `isTxt(bytes: Buffer): boolean`.
`maxCvBytes = 4 * 1024 * 1024` exported by cv-upload and re-exported from server/cv-text.
New `CvExtractionReason = null | 'scanned' | 'unsupported' | 'empty' | 'too_large' | 'timeout'`.
New `CvExtraction = { text: string; reason: CvExtractionReason }`.
New `extractCv(input: Uint8Array, filename: string): Promise<CvExtraction>`.
Existing `extractCvText`, `parseCvText`, `normalizeProfile`, `isDocx` remain compatible.
Optional CandidateProfile fields: `name?: string`, `email?: string`, `phone?: string`, `certifications?: string[]`, `positions?: {title: string; company: string; start: string; end: string}[]`, `parse?: {confidence: number; reason: string | null}`. Position date values are YYYY-MM or YYYY, with present allowed for end. Parser reasons: empty, low_confidence, approximate_dates, null. Confidence counts four signals equally: text, contact, dated position, skill.

## Owner validation and remaining integration

After inspecting/integrating, run `npx tsc --noEmit -p .` and the requested tests with local DATABASE_URL only: cv-parse, cv, cv-upload, cv-fixtures, company-cv-box.integration. Record actual pass/fail counts and every fixture timing. Do not run the old evaluate.ts to overwrite results.json before the regression test. No server restart or production action was performed.

UI/D3: accept .pdf,.doc,.docx,.odt,.rtf,.txt; replace talent-view's size guard and help copy with 4 MB; render/edit contacts, certifications and positions; show parse confidence/reason. Call extractCv and retain extraction reasons when text is empty, rather than losing them through the compatibility wrapper. Preserve manually edited profiles during reparse. API upload response/persistence wiring was outside the authorized minimal upload-check edits.

New/changed Georgian messages needing translations:
- `ფაილი 4 MB-ზე დიდი არ უნდა იყოს.`
- `აირჩიეთ CV ფაილი.`
- `ატვირთეთ PDF, Word (DOC, DOCX), ODT, RTF ან TXT ფაილი.`

Known limits: binary DOC remains best effort; no OCR or LLM; RTF legacy byte decoding supports cp1251/cp1252, not every codepage; DOCX run fonts are direct w:rFonts (inherited style font resolution not implemented); PDF font handling depends on pdfjs exposing original names. Full-width gutter-crossing lines are preserved in vertical bands. All these paths still require execution in the owner checkout.


## Exact owner commands (from target checkout, after integration)

First regenerate **only** the incorrectly tagged PDF; this mode leaves expected.json, results.json and every other binary untouched:

```sh
npx tsx tests/fixtures/cv-samples/generate.ts --legacy-only
npx tsc --noEmit -p .
DATABASE_URL=postgresql://localhost:5432/jobx_company_local RUN_COMPANY_DB_TESTS=1 npx tsx --test --test-concurrency=1 tests/cv-parse.test.ts tests/cv.test.ts tests/cv-upload.test.ts tests/cv-fixtures.test.ts tests/company-cv-box.integration.test.ts
git diff --check
```

RUN_COMPANY_DB_TESTS=1 enables the integration suite instead of silently skipping it; never substitute the production DATABASE_URL. Return exact failures, test counts, per-field totals and timings. The test corpus and fixture generator were not executed in this isolated worktree.
