# Public navigation refinement — 2026-09-14

- Preserved the original JOBX logo and 3D illustrations. Reduced masthead logo to 120×40 desktop / 90×30 mobile.
- Introduced one PublicHeader for catalogue, saved catalogue, vacancy and company routes. Search, saved, personal space and theme retain consistent positions. Removed the extra menu layer; contextual return links remain in the page content.
- The always-visible all-vacancies link clears saved-only mode and search filters on the catalogue. Other routes link to `/`. Modifier-click navigation remains available.
- Footer uses aligned navigation and help, reduced logo and 44px controls; mobile footer groups remain left aligned.
- Original source links and health status now form a compact line after vacancy content, before similar vacancies. Multiple sources, source-change notices and employer full-text links remain available.
- Similar vacancies fetch after local hidden-vacancy preferences are ready, without waiting for IntersectionObserver/scroll. Placeholder cards reserve visible space during network delays; failure/retry and empty states remain.

Validation: full test run 222 total, 209 passed, 13 environment-dependent skips; production build passed. Subsequent cosmetic adjustments and removal of an unused import verified with typecheck/lint and theme generation. Browser checks: 320px saved-to-all navigation returns `/`; source precedes similar section; 2 similar cards loaded before scrolling; desktop and mobile header/footer inspected. No low-end-device timing or guaranteed API latency claimed.

## Automatic continuation

The catalogue now observes the end-of-list control with a 600px lead-in and appends the next page automatically. It disconnects after triggering and re-arms when that page finishes. Pending searches, open filters, in-flight pages, end-of-results and errors suspend automatic loading. The existing button remains as a keyboard/fallback control and becomes an explicit retry after errors. The current append pipeline still deduplicates IDs, cancels obsolete fetches and preserves the loaded range for vacancy return navigation.

Validation: typecheck/lint and 5 navigation tests passed; browser scrolling loaded 20 → 40 without clicking, with 40 unique vacancy IDs.

## Mobile filter access, save confirmation and card target

- Mobile results controls remain sticky 60px below the shared header; the wrapper uses display:contents so the controls remain sticky through the result list. Selected-filter count, sorting and sharing remain available.
- Successful bookmark writes fill the icon and show a dismissible confirmation with undo. Undo changes the latest target ID and restores an item displaced by the 100-item limit without replacing the entire saved list. Failed storage writes retain the previous UI state and show an error.
- The existing native vacancy link stretches over blank card space; employer links, save controls and selectable metadata remain above it. Native keyboard/modifier-click behavior remains. A short post-swipe suppression prevents the gesture's subsequent click from opening a vacancy.

Validation: typecheck/lint, 9 navigation/theme tests and production build passed. At 390px, toolbar computed sticky/top:60px, parent display:contents, no horizontal overflow. Full live card/save/undo interaction checks were blocked: catalogue API returned an error on initial load and explicit retry. Do not describe these live interactions or low-end-phone performance as measured.
