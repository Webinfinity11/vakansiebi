# Admin tracking settings and compact search directory

The admin panel's “პიქსელები და კოდები” section shows the existing Google Analytics
(G-9S8J0W7QXM), Yandex Metrika (112737833), and Top.ge (118973) identifiers and their
enabled state. It also contains the supplied Meta Pixel (1422360353191134) snippet.
Each integration can be edited or disabled without another application build.
Settings take effect on the next document load; scripts already running in an open
tab are not unloaded remotely.

Migration 049 creates and seeds the singleton settings record. The admin API
requires a valid admin session, verifies the request origin on writes, validates
input and an optimistic version, and writes an audit entry in the same transaction.
Disabled identifiers/snippets are excluded from the public settings response.
Configuration failures do not re-enable disabled trackers.

All counters share one uncached settings request per public production document.
Custom HTML is trusted administrator code. It is displayed as text in the editor
and executes once per document on allowed public pages after hydration. It does
not automatically rerun on client-side navigation. Inline and external scripts
are supported; sequential external scripts complete before following setup code.
The JavaScript-only loader does not provide a no-JavaScript tracking fallback;
noscript contents are not executed and cannot duplicate the normal pixel event.

The search directory shows three links per topic, plus all four main destinations.
Other links remain in the rendered HTML inside native details. The “show more”
summary disappears when expanded, and a collapse button sits after the last link.
No keyword text or landing URLs were added or changed. Link priority currently
reflects active vacancy counts, not measured Google search volume.

Validation:
- TypeScript, lint, production build and 14 focused tests passed.
- Browser/API checks covered authentication, CSRF origin, invalid input, stale
  versions, saved settings, existing IDs, cancel, mobile width and inert admin code.
- Browser checks covered directory expansion and collapse, one execution of custom
  scripts, and the supplied pixel queuing exactly one init and one PageView.
- Production browser checks stub third-party requests so test visits are not sent
  to analytics services.

SEO assessment: city + vacancies, profession + vacancies, experience requirements
and remote work are useful candidate intents. Their exact search volumes have
not been measured. Search Console query impressions/clicks and Georgia-targeted
Keyword Planner estimates are needed before calling any of them high-volume.
Avoid treating broad labels such as “specialist” as evidence of a precise intent.

References:
- https://developers.google.com/search/docs/crawling-indexing/links-crawlable
- https://support.google.com/webmasters/answer/7576553?hl=en
