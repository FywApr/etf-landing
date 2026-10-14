# Operations: database, configuration, privacy and retention

How to set up and run lead capture. Nothing here has been done for you: no database is provisioned, no credentials exist in the repository, and the privacy notice has not had a legal review.

## 1. Provision the database

1. Create a project at [neon.tech](https://neon.tech) in an EU region.
2. Open the **SQL Editor**, paste the whole of [`db/schema.sql`](../db/schema.sql) and run it. The script is idempotent and never drops anything.
3. In **Connection Details**, copy the **pooled** connection string. Treat it as a secret.

## 2. Configure the environment

Set these in `.env.local` for local development (copy [`.env.example`](../.env.example)) and in the hosting platform's environment settings for each deployed environment. None may be prefixed with `NEXT_PUBLIC_`.

| Variable | Purpose | Who decides |
|---|---|---|
| `DATABASE_URL` | Neon connection string | Developer |
| `DATA_CONTROLLER_NAME` | Legal name of the data controller, shown in the privacy notice | Data controller |
| `DATA_CONTROLLER_ADDRESS` | Controller's address | Data controller |
| `DATA_CONTROLLER_EMAIL` | Contact for data requests and consent withdrawal | Data controller |
| `PRIVACY_NOTICE_VERSION` | Label for the current notice wording; stored with each lead | Data controller |
| `LEAD_RETENTION_DAYS` | Retention for leads without marketing consent; proposed 30 | Data controller |
| `CONSENTED_LEAD_RETENTION_DAYS` | Retention for leads with marketing consent; proposed 365 | Data controller |
| `FUNNEL_EVENT_RETENTION_DAYS` | Retention for funnel events; proposed 90 | Data controller |

Retention values are whole days from 1 to 3650, with no defaults. See section 7 for what each period means.

**If any value is missing or invalid, lead capture is off.** The form returns "Formulář je dočasně nedostupný…", nothing is stored, and the privacy page shows a notice that the policy is not published. The server log names the missing variables, never their values.

Guide downloads need only `DATABASE_URL`. Funnel events (from the browser and the `guide_download` event) are recorded only when `DATABASE_URL` and `FUNNEL_EVENT_RETENTION_DAYS` are both valid; otherwise they are validated and discarded, and downloads still work.

## 3. Check the connection and configuration

```
npm run db:check
```

This reads `.env.local` and prints:

- whether the retention policy is valid, naming any missing or invalid variables;
- whether the connection works;
- whether both tables exist;
- whether migration 001 has been applied.

It never prints values or the connection string; on failure it prints only the error class and code. It exits with an error if anything is wrong.

## 3a. Upgrading an existing database

A database created from the first version of `db/schema.sql` needs [`db/migrations/001_bounded_retention.sql`](../db/migrations/001_bounded_retention.sql), applied by hand in the Neon SQL Editor. It is forward-only and deletes nothing:

1. It drops the constraint that forced consented leads to have no retention date.
2. It gives each such lead a date of its last guide request (`updated_at`) plus 365 days. Change 365 in the file first if `CONSENTED_LEAD_RETENTION_DAYS` is configured differently.
3. It makes `retention_expires_at` required.
4. It adds an index on `funnel_events.occurred_at`.

It is safe to run twice. `npm run db:check` reports whether it has been applied. Until it is, saving a lead with consent fails, because the application now writes a retention date for every lead and the old constraint forbids that for consented leads.

A fresh installation needs only `db/schema.sql`, which already matches the migrated schema.

## 4. What the controller must confirm before launch

These are drafts written by a developer, not legal advice:

- **Controller identity and contact.** The three `DATA_CONTROLLER_*` values.
- **Privacy notice wording** in `app/ochrana-osobnich-udaju/page.tsx`, including the stated legal bases (handling the request for the guide; consent for marketing).
- **Retention periods.** The proposed 30, 365 and 90 days (section 7), and the definition of "last activity" as the most recent guide request.
- **Marketing consent wording** in `lib/consent.ts`. Changing the text requires a new `version`; a test enforces this.
- **Whether a single opt-in is acceptable.** Consent is recorded when the box is ticked. The address is not verified by a confirmation email, so someone could enter another person's address. Do not send marketing email to these addresses until a confirmation (double opt-in) step exists.

## 5. How lead capture behaves

- The email is trimmed and lower-cased, then validated on the server. There is one lead per address, case-insensitively.
- A new address creates a lead. A known address refreshes it: a new guide token replaces the old one (the old link stops working), and the acquisition context is updated. The visitor sees the same result either way.
- Marketing consent is only ever added by a submission. An unticked box on a later submission does not remove existing consent.
- The lead and its `lead_created` event are written by one SQL statement, so both happen or neither does.
- The guide is never emailed. No email provider is connected.

## 6. Guide tokens

- 32 random bytes, base64url-encoded, generated per request.
- Only the SHA-256 hash is stored. The token appears once, in the thank-you URL.
- Valid for 7 days (`GUIDE_TOKEN_TTL_DAYS` in `lib/guide-token.ts`); checked against the database clock on the thank-you page and on every download.
- Invalid, unknown and expired tokens all get the same "Odkaz je neplatný nebo jeho platnost vypršela." response.
- The token is in the query string of `/dekujeme` and `/api/guide`, so it will appear in the hosting platform's request logs. The application itself never logs it, and both responses send `Referrer-Policy: no-referrer`.

## 7. Retention and withdrawal

### Policy

The periods below are **proposed for this assignment**. They are not legally mandated or reviewed, and the data controller must confirm them before public launch.

| Data | Period | Counted from |
|---|---|---|
| Lead without marketing consent | `LEAD_RETENTION_DAYS`, proposed 30 days | the lead's last activity |
| Lead with marketing consent | `CONSENTED_LEAD_RETENTION_DAYS`, proposed 365 days | the lead's last activity |
| Funnel event | `FUNNEL_EVENT_RETENTION_DAYS`, proposed 90 days | the event's `occurred_at` |
| Guide token | 7 days, fixed in code | when it was issued |

**Last activity** means the most recent successful guide request, stored in `updated_at`. Only a guide request updates it. Marketing email is not sent, so there are no email-engagement events, and nothing else counts as activity.

Each successful guide request:

- sets `updated_at`;
- sets `retention_expires_at` to now plus the period for the lead's consent state after the request;
- issues a new token with its own 7-day expiry, independent of retention.

A repeated request does not refresh consent: if the box is ticked again for the same consent text, the original `marketing_consent_at` is kept. An unticked box never removes consent.

A lead is deleted when **either**:

- its `retention_expires_at` has passed; or
- its `updated_at` is older than the currently configured period for its consent state.

The second rule means that shortening a period also applies to leads saved under the longer one.

Funnel events are deleted by age alone. A lead that still exists does not keep its session's events, and a deleted lead does not remove them early. **Deleted events disappear from all historical funnel reports.**

### Running the cleanup

Nothing is deleted automatically. **No scheduled job is configured.** Until one is, the periods are only enforced when someone runs the cleanup.

```
npm run retention:cleanup
```

This command:

1. Reads `DATABASE_URL` and the three retention variables from `.env.local`, and stops with an error naming any that are missing or invalid.
2. Deletes expired leads, then expired funnel events, in batches of 1000. Each batch is one statement, so each batch is atomic; the Neon HTTP driver has no multi-statement transactions.
3. Prints only the policy and the number of rows deleted. No emails, session IDs or tokens are printed.

It exits with an error if the database fails, after reporting how many rows were deleted before the failure. If more than 100 batches are due in one table, it says so; run it again.

The command deletes data in whichever database `DATABASE_URL` points to. Before running it against the production database, run `npm run db:check` to confirm the target and that migration 001 is applied.

[`db/retention-cleanup.sql`](../db/retention-cleanup.sql) contains the same rules with the proposed values written in, for running by hand in the SQL Editor.

To schedule it later, run the same logic on a timer, for example with a Vercel Cron Job calling a protected endpoint, or with a scheduled CI job running the command. Neither exists yet.

### Withdrawing marketing consent

When someone asks, run this with their address in lower case, replacing `30` with the configured `LEAD_RETENTION_DAYS`. It removes the consent and applies the shorter period from the last guide request, so the lead may be due for deletion straight away. It does not count as activity, so it leaves `updated_at` alone.

```sql
update leads
set marketing_consent = false,
    marketing_consent_at = null,
    marketing_consent_text_version = null,
    retention_expires_at = least(retention_expires_at, updated_at + make_interval(days => 30))
where email = 'address@example.com';
```

**Erasure request.**

```sql
delete from leads where email = 'address@example.com';
```

Funnel events contain no personal data by themselves, but the deleted lead's `session_id` linked them to the address. To remove that session's events too, select the lead's `session_id` first and then `delete from funnel_events where session_id = '…'`.

## 8. Abuse protection: what exists and what does not

Exists:

- A hidden honeypot field; a filled one is rejected.
- A minimum time between the form appearing and its submission (1.5 s). The timestamp comes from the browser, so a deliberate bot can fake it.
- Server-side validation of every field, and a 2 KB limit on analytics requests.

Does not exist:

- **Rate limiting.** There is none, for the form, the events endpoint or the guide route. An in-memory limiter would not work across serverless instances, so none was added. Configure rate limiting at the platform level (for example Vercel Firewall rules for `/api/events`, `/api/guide` and POSTs to the landing pages) before launch.
- **CAPTCHA or bot detection.**
- **Email verification.**

The form requires JavaScript: without it the timing check fails and the submission is rejected.

## 9. Logging

Server logs contain a scope and the error class and Postgres error code only. Error messages are not logged because they can include submitted values. Emails, tokens, request bodies and connection strings are never logged by the application.

## 10. What was and was not tested

- The schema and every SQL statement run in the test suite against PGlite, which is Postgres compiled to WebAssembly and running inside the test process.
- **No connection to Neon was made.** The Neon driver call itself (`lib/db.ts`) is the one part not exercised by tests. Run `npm run db:check` and submit the form once after configuring a real database.
