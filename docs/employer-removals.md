# Employer withdrawal

`/admin` → **ამოღებული ვაკანსიები** contains removal requests, active employer blocks and private snapshots of removed vacancies. Removing a block does not republish old jobs.

Two additive migrations (`061`, `062`) must run before deploying the application. A PostgreSQL trigger prevents blocked contacts, exact normalised company aliases and recorded source URLs from being published by any importer, including older worker processes. Removed records survive vacancy retention cleanup.

## Confirmation links

New application and publication emails include a recipient/job-scoped HMAC link. Opening it is read-only; an explicit same-origin POST removes the employer's listings and queues an acknowledgement. Tokens expire after 180 days. The private page is excluded from analytics, indexing and third-party referrer transmission. `List-Unsubscribe` advertises this URL and, when receiving is configured, a direct `mailto:` unsubscribe address. Native unsubscribe emails therefore reach the webhook without relying on HR forwarding.

`REMOVAL_LINK_SECRET` optionally provides a dedicated key; otherwise the existing `SESSION_SECRET` is used. Do not rotate it without accounting for outstanding links.

## Replies

`POST /api/webhooks/removals` verifies Resend/Svix signatures and fetches the received message with `html_format=cid`; attachments are never downloaded. Only newly authored text is classified. Automatic removal requires a clear withdrawal instruction, receiving-server DKIM/DMARC authentication and an exact existing employer contact match. Other plausible requests appear for review.

Required server secrets:

- `RESEND_REMOVALS_API_KEY`: receiving-capable Resend credential.
- `RESEND_REMOVALS_WEBHOOK_SECRET`: signing secret for the `email.received` webhook.
- `REMOVALS_INBOUND_ADDRESS`: the dedicated receiving address on the account's `.resend.app` domain.

The backend alone does not route HR replies. Keep the existing HR-to-Gmail delivery and add a second copy to `REMOVALS_INBOUND_ADDRESS`, either in the forwarding provider or through a verified Gmail forwarding filter restricted to `to:hr@jobx.ge`. Do not enable forwarding of the entire personal mailbox. Verify the receiving address and test an actual message addressed to HR before considering this connection live.

Acknowledgements are queued only after removal commits, use provider idempotency keys and retry through webhook delivery and the existing invoice-email cron. A 23-hour retry boundary prevents duplicate sends after the provider's idempotency window expires. Requests expose confirmation state in the admin.

## Validation

Run migrations against the isolated `ertad_test` database, then:

```sh
RUN_DB_TESTS=1 DATABASE_URL=postgresql://localhost/ertad_test pnpm exec tsx --test tests/employer-removals.test.ts
```

Tests cover signed links, expiry, header forgery, replayed webhooks, quoted/negated requests, persistent import blocking, actual removal and one acknowledgement per request. Never point these database tests at production.

## Admin preview

Enter one company name per line; commas remain part of a name. The authenticated
`GET /api/admin/removals?preview=1&companyName=...` returns matching company names,
published counts and total matching records (including unpublished records). Repeat
`companyName` for aliases; an optional `email` also previews contact matches and aliases
from its existing rule. The form debounces requests and discards stale responses.
The companies tab also previews counts before confirming a name-only block; it sends no email.

Preview and block share `removalCompanyKeys` and the SQL candidate predicate. Blocking
materializes candidates before checking existing rule precedence, avoiding full-table
per-rule matching for name-only requests. No new migration is required; the database
trigger still protects every importer. Counts are a snapshot and can change before submission.
