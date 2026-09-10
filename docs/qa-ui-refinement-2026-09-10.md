# Vacancy reading flow and card refinement — 2026-09-10

Vacancy cards now use less space, omit empty metadata rows and the generic “სხვა” tag, and show conservative compact pay wording. The detail overview has one separator instead of nested colored containers. Salary, workplace and schedule remain prominent; source prose retains its wording. Where verified employer text was appended, that text appears first and the complete source introduction follows visibly, with functional labeled links. Facts already present in the description or overview are not repeated in an additional facts panel. The hide action is under “მეტი მოქმედება”.

The source catalogue shows the number of sources rather than a second vacancy total with different cache/exclusion semantics. Daily-work and daily-pay shortcuts have distinct labels and preserve their distinct query parameters. Remote logos retain a neutral mark while loading or after failure; successfully loaded logos replace it without resizing the frame.

## Data correction

The parser fills an empty city only from explicit workplace/location labels. It preserves existing values, rejects conflicting recognized locations, and does not infer a workplace from an employer introduction or a street named Rustaveli. A guarded, audited backfill updated 90 existing publications. Verification against a local pre-change snapshot confirmed that only city changed in both raw and published snapshots; original descriptions and every other field matched. Source discovery remains paused for all four active sources.

## Verification

- TypeScript, lint and production build passed.
- 105 automated tests passed against the isolated local test database; production credentials were not used for the test suite.
- Local and production browser QA covered 6 vacancy detail pages and verified 104 original text segments remain visible.
- Widths: 1440, 1024, 768, 390 and 320 pixels; no horizontal overflow in checked pages.
- Whole-card navigation, bookmark without navigation, phone and email links, clipboard copying, distinct daily filters and bounded contact positioning passed on local and production.
- Original source introduction links are visible and functional; Irao's Rustavi workplace and compact salary are present; its redundant extra salary panel is absent.
- Local browser interception verified both pending and failed external images retain the neutral mark; successful loading replaces it with the logo.

## Performance sample

Three cold-browser runs per viewport on production after the layout changes (before the final logo loading-state patch), with browser caches disabled. Mobile used 100 ms network latency, 200 KB/s download and 4× CPU slowdown. These are laboratory samples, not real-user percentiles.

| Metric | Desktop | Simulated mobile |
| --- | --- | --- |
| Results visible, individual runs | 6477 / 1890 / 1848 ms | 3882 / 3529 / 3537 ms |
| Median results visible | 1890 ms | 3537 ms |
| LCP, individual runs | 2980 / 868 / 1144 ms | 1724 / 1556 / 1516 ms |
| Resource transfer | approximately 415 KB | approximately 415 KB |

One desktop run took 6.5 seconds. Results are variable, so this sample does not establish a speed improvement. An earlier overlapping-browser measurement was discarded because other browser QA ran concurrently.

This is a scoped regression and visual review, not a complete accessibility audit or proof that every source vacancy is correctly parsed. Unrecognized and ambiguous workplace locations remain unfilled; missing employer artwork is represented neutrally, never invented.
