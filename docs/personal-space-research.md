# Personal workspace: research and implementation decisions

Reviewed 2026-09-09. Scope: saved searches and manual application tracking without registration, notifications or automatic applications.

## Evidence and decisions

- Indeed's [My Jobs overview](https://support.indeed.com/hc/en-us/articles/205332490-My-Jobs-Section-Overview) separates saved, applied, interview and archived stages. Our equivalent is planned, applied, interview and closed, with manual transitions in either direction. Opening a source link never changes application status.
- Indeed's [job alerts documentation](https://www.indeed.com/help/job-seekers/articles/204488890-starting-stopping-and-managing-job-alerts?hl=en&co=US) treats alerts as a subscription. Saving search criteria here only restores filters; it does not subscribe the visitor to messages.
- [MDN localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage) documents per-origin persistence and restricted/private browsing behaviour. The UI explicitly says same browser only; clearing site data removes the records. Localhost and the production domain are separate stores. No public login or personal-data endpoint is introduced.
- [MDN storage events](https://developer.mozilla.org/en-US/docs/Web/API/Window/storage_event) explains that changes reach other same-origin tabs, not the originating document. The hook therefore refreshes after its own successful write and listens for storage events from other tabs. Per-record keys avoid unrelated stale-tab edits replacing the entire collection. Simultaneous edits to the same record remain last-write-wins; this is not cross-device synchronization.
- [MDN storage quotas](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) requires handling storage failures. We report failed saves, retain existing records, validate versioned payloads and cap searches at 20 and application snapshots at 200. No oldest-record eviction occurs automatically.
- [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) and [form labels](https://www.w3.org/WAI/tips/developing/) inform labelled controls, semantic status output, error alerts, native selects and keyboard-operable dialogs. Deletion has an explicit undo action.

## Product behaviour

Saved searches include query, city, category, source, salary-presence filter, remote filter and sort. Applying one resets pagination and exits the bookmark-only view. Equivalent filters update the existing saved search rather than creating duplicates. There are no invented new-result counts or hidden searches in the background.

Applications store only the job ID, title, employer, city, source URL, deadline, current personal stage and update timestamp. They remain visible if a public listing expires or is removed. These are labelled historical snapshots, not claims of current availability or employer responses. HTTPS URLs are validated before use. Preview-only unpublished vacancies cannot be added through the detail control.

Existing bookmark storage is preserved. The new workspace uses its own versioned namespace; corrupt entries do not prevent healthy entries from loading and are not silently removed. No account, CV upload, email/SMS delivery, employer submission, interview reminder or application-status integration is included.

## Verification

Unit tests cover duplicate search identity, complete filter persistence, corrupt data isolation, preservation of old bookmarks, independent record writes, snapshots, deletion/restoration, unsafe URLs, versions, limits and failed storage writes. Browser checks cover save/reopen, search restoration, application transitions, undo, reload persistence and basic narrow-screen layout.
