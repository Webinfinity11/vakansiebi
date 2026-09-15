# Source candidate test — 14 September 2026

Samushao.ge remains excluded at the owner's request. No CV.ge or JOBS.On.ge record was staged or published during candidate testing.

## CV.ge

- Public listing and four sampled detail pages returned HTTP 200. Public robots.txt allows crawling.
- First listing page contained 100 distinct announcement IDs. 98 already existed in our HR.ge source items, with imported records.
- The other two IDs (493288 and 493383) also resolved on HR.ge. Live title and company matched CV.ge; both were dated 14 September. They represented discovery lag in the existing integration, not demonstrated CV-exclusive jobs.
- Four sampled pages passed the existing vacancy schema using the shared HR announcement parser in a compatibility test. Titles were present in the page; company, city, publication date, deadline and description were populated. Description lengths: 1,232–2,207 characters. Missing salaries stayed empty; a disclosed range remained 1,100–1,500 GEL, and a USD-plus-bonus offer retained its qualifications.
- The test did not register a new source or alter source attribution. A future CV integration must preserve CV URLs and check duplicates across hosts. The tested page does not prove that the entire CV catalogue overlaps HR.

Decision: prioritize timely HR.ge discovery before adding a second feed for this largely overlapping sample.

## JOBS.On.ge

- Public robots.txt permits the tested public listing paths.
- `/`, `/ge` and `/ge/new` returned pages, but the main and new-vacancy views explicitly displayed “განცხადებები ვერ მოიძებნა” / “Nothing was found”. No vacancy detail links were available in those responses.
- Detail parsing, salary/date correctness and duplicate handling therefore could not be tested from current live listings.

Decision: do not enable production import with zero verifiable live vacancy samples. This is a point-in-time result, not a claim that the platform is permanently inactive.

## Existing integrations

`npm run source:probe` succeeded for all seven active sources: hr, jobs, ss, hrgov, gancxadebebi, worknet and myjobs. Each probe fetches a list and one detail and parses it, without writing jobs.

Expected omissions remain honest: Jobs.ge's sampled posting lacked a clear city; hrgov lacked a publication date; the classified advertisement lacked an employer and a deadline. These fields were not invented. This one-record-per-source smoke test is not exhaustive catalogue QA.

After these read-only checks, a bounded HR.ge import was started using the existing validated importer, source locks, duplicate checks and publication rules. Candidate sources remain disabled/unregistered.

The bounded HR run completed: 200 discovered IDs, 2 newly imported records, 0 failures. Both sampled missing IDs were confirmed published and returned HTTP 200 on jobx.ge.
