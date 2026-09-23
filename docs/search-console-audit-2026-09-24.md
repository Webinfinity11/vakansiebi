# Search Console follow-up — September 24, 2026

Read directly from the authenticated Google Chrome session for the HTTPS property `https://jobx.ge/`. These are observed report values, not a full-site indexing count inferred from a crawler.

- Page indexing, last updated September 21: **35 indexed**, **7 not indexed**.
- Four redirects: historical Georgian-script city/category/company/vacancy URLs. Redirect exclusions do not themselves require removal.
- One noindex: `/post-job`, last crawled September 16. The form intentionally stays noindex; its inclusion in the pages sitemap was inconsistent.
- Two crawled/not indexed: `/sitemap.xml` and `/sitemap-index.xml`. XML discovery documents need not appear in search results.
- Performance chart September 14–21: **55 clicks, 105 impressions, CTR 52.4%, average position 5**; report updated six hours before viewing. Query `jobx` accounts for 38 visible-query clicks and 43 impressions. This does not establish ranking for generic job queries.
- All five sitemap submissions (September 23) remain **Unknown / Couldn't fetch**, no last-read date, zero discovered pages. Public retrieval succeeded earlier in this session, but it does not prove Google ingestion. The Google-internal processing failure is unresolved.
- Google's Search Status Dashboard lists no broad incident; this does not rule out a property-specific processing issue.

## Corrections

- Removed the intentionally noindex `/post-job` form from `pagesEntries` and added regression coverage.
- Explicit work-address facts/labelled location lines now supply all supported job cities to JobPosting. Ambiguous incidental mentions still do not invent multiple workplaces.
- CV page emits its introductory heading during SSR; template preview names use styled paragraphs rather than repeated H1s, retaining print styling.
- Retired `from` parameters permanently redirect to the same public path with other parameters preserved; no API or form POST redirect. Existing pending clean-link/history-navigation changes and robots leaf declarations were included and tested.

## Validation

483 tests passed, 28 skipped, zero failures (511 total); TypeScript, lint and production build passed. Built app checked at localhost:3012: clean redirects, all five robots declarations, pages sitemap exclusion, server-rendered CV heading, exactly one hydrated H1, unchanged preview names, desktop/mobile overflow and no page errors.

Publication uses the repository's existing GitHub `deploy.yml` workflow. Do not mark the Google sitemap error resolved until a later Search Console report shows successful processing.
