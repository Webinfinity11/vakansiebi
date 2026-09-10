# Search and discovery design — 2026-09-10

The supplied visual reference informed the dark blue masthead, prominent white search panel, four compact shortcut cards and an icon-based category gallery. The layout is adapted to vacancy discovery; the background is CSS and the icons use the existing SVG icon library. No new image downloads, dependencies or external requests were added.

Search modes drive the existing all/daily/part-time/internship employment filter. The four cards toggle daily pay, remote work, no experience required and disclosed salary. Daily pay remains distinct from a one-day job. Eight category buttons toggle the existing category filter. “ყველა მიმართულება” reveals the full filter list without resetting the selected category. Search submission scrolls to results and respects reduced-motion preference.

The previous secondary source totals were replaced by the existing catalogue's source count in the reassurance row, keeping the current result total in the results heading. Desktop results remain within the first 1000-pixel viewport; mobile search modes and categories scroll horizontally within their containers.

## Verification

- TypeScript, lint and production build passed.
- Visual review at 1440×1000 and 390×844.
- Browser overflow checks at widths 1440, 1024, 768, 390 and 320 passed.
- All search modes and all four shortcuts updated the correct existing URL parameters and could be cleared.
- Text search and submit-to-results behavior passed.
- Category selection/toggle and opening all mobile categories while retaining the selected category passed.
- Card/contact regression passed: whole-card navigation, bookmark without navigation, clipboard, mail/phone destinations and contact panel positioning before similar results.
- No JavaScript page errors in the checked flows. No applications or emails were submitted during QA.

This change does not resume source discovery or alter stored vacancy data, personal progress, parser rules or notification behavior.
