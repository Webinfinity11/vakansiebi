# Personal vacancy activity — 2026-09-10

Opening a public vacancy retains the existing automatic seen marker. Cards and similar vacancies now display the user's application stage in preference to the seen badge. The compact status control sits below contact actions, or in a separate personal panel when no contact action is available. The personal space opens on applications and supports stage filtering.

Explicit mail, phone and recognized application-link clicks record “დაკავშირება დაწყებულია”. This never claims delivery. The user can confirm “კი, გავაგზავნე” or choose planned, sent, interview, offer, hired, rejected or closed. Clicking a contact again does not downgrade an existing stage or rewrite its timestamp. Clearing the stage retains seen activity. Existing local records are preserved. Same-page hooks use a change event; browser tabs synchronize through storage events.

No visitor account, database write, email send or notification was introduced. Records remain local to the browser, using the existing limits of 500 recently seen IDs and 200 application snapshots. Opening an external link does not let the site verify an actual submission or employer receipt.

## Checks

- TypeScript, lint and production build passed.
- 107 automated tests passed in the isolated local test database. New cases cover initial contact intent, all later-stage guards and compatibility with existing records.
- Local browser QA: automatic seen marker; email and external-form intent; explicit sent confirmation; no downgrade after phone click; reload persistence; cross-tab updates; status on search cards; reset preserving seen.
- Contact regression: whole-card navigation, bookmark without navigation, clipboard, mail and phone destinations, and contact panel bounded before similar vacancies.
- Checked widths: 1440, 1024, 768, 390 and 320 pixels, with no horizontal overflow.
- Separate no-contact page checked at desktop/mobile widths.
- Simulated storage failure displayed an error without claiming success or preventing the contact link's normal action.
- External navigation was intercepted during QA; no email or application was submitted.
