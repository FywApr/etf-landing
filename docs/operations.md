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
| `RATE_LIMIT_SECRET` | At least 32 random characters; keys the per-client rate-limit hash. Without it only global limits apply. Generate with `openssl rand -base64 48`. | Developer |

Retention values are whole days from 1 to 3650, with no defaults. See section 7 for what each period means.

`RATE_LIMIT_SECRET` is optional for lead capture; every other variable above is required.

**If any required value is missing or invalid, lead capture is off.** The form returns "Formulář je dočasně nedostupný…", nothing is stored, and the privacy page shows a notice that the policy is not published. The server log names the missing variables, never their values.

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

[`db/migrations/002_rate_limits.sql`](../db/migrations/002_rate_limits.sql) adds the `rate_limits` table. It is additive (create table and index only) and safe to run twice. Until it is applied, the rate limiter allows every request and logs `[rate-limit:*]` errors with code 42P01.

A fresh installation needs only `db/schema.sql`, which already matches the migrated schema.

## 4. What the controller must confirm before launch

These are drafts written by a developer, not legal advice:

- **Controller identity and contact.** The three `DATA_CONTROLLER_*` values.
- **Privacy notice wording** in `app/ochrana-osobnich-udaju/page.tsx`, including the stated legal bases (handling the request for the guide; consent for marketing).
- **Retention periods.** The proposed 30, 365 and 90 days (section 7), and the definition of "last activity" as the most recent guide request.
- **Rate-limit records.** Storing a keyed hash of the IP address for 24 hours to prevent abuse, and its description in the notice.
- **Processors and recipients.** The notice does not yet name the hosting provider (Vercel) or the database provider (Neon), their regions, or any transfer outside the EU. The controller must decide what to state.
- **Session linkage.** Analytics events are linked to a lead through the session ID. The notice says so; the controller must accept it or ask for the link to be removed.
- **Marketing consent wording** in `lib/consent.ts`. Changing the text requires a new `version`; a test enforces this.
- **Whether a single opt-in is acceptable.** Consent is recorded when the box is ticked. The address is not verified by a confirmation email, so someone could enter another person's address. Do not send marketing email to these addresses until a confirmation (double opt-in) step exists.

## 5. How lead capture behaves

- The email is trimmed and lower-cased, then validated on the server. There is one lead per address, case-insensitively.
- A new address creates a lead. A known address refreshes it: a new guide token replaces the old one (the old link stops working), and the acquisition context is updated. The visitor sees the same result either way.
- Marketing consent is only ever added by a submission. An unticked box on a later submission does not remove existing consent.
- The lead and its `lead_created` event are written by one SQL statement, so both happen or neither does.
- The guide is never emailed. No email provider is connected.

## 6. Guide tokens and protected downloads

- **Generation and storage.** 32 random bytes, base64url-encoded, generated per successful submission. Only the SHA-256 hash is stored.
- **Delivery.** The token never appears in a URL. The server action sets it in an HttpOnly cookie and redirects to plain `/dekujeme`. The cookie is SameSite=Strict, has a 7-day max-age and uses path `/`; in production it is also `Secure` and named `__Host-guide_access`. Page scripts cannot read it, other sites' requests do not carry it, and it is not written to request logs as part of a URL.
- **Access.** `/dekujeme` and `/api/guide` read the cookie, hash it and look the hash up. The expiry is checked against the database clock on every request. A `?token=` or `?t=` query parameter is ignored.
- **Lifetime.** 7 days (`GUIDE_TOKEN_TTL_DAYS`), independent of data retention.
- **Repeat submissions.** A repeat submission replaces the stored hash and the cookie, so the previous token stops working everywhere.
- **Generic denials.** Missing, malformed, unknown and expired tokens get the same response. `/api/guide` answers 404 with "Přístup k průvodci vypršel nebo v tomto prohlížeči není k dispozici…", and `/dekujeme` shows "Přístup k průvodci není platný".
- **Cookie scope.** Access works only in the browser that submitted the form. A visitor who switches device must request the guide again.
- **Headers.** Responses are `Cache-Control: private, no-store` and `Referrer-Policy: no-referrer`, with `X-Robots-Tag: noindex, nofollow` and `nosniff`.
- **Analytics failure.** `guide_download` is recorded only after the token is valid and the PDF is generated. If recording fails, the PDF is still delivered.
- **Old links.** Thank-you URLs with `?t=` from before this change no longer grant access. Their tokens may still be in browser histories; they expire within 7 days of issue.

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

## 8. Abuse protection and rate limiting

### Application-level limiter (implemented)

`lib/rate-limit.ts` keeps fixed-window counters in the `rate_limits` table, so all server instances share them. Each check is one atomic SQL statement.

| Bucket | Applies to | Per client | Global | Window |
|---|---|---|---|---|
| `lead` | form submissions that pass validation and reach the database | 5 | 100 | 10 min |
| `guide` | `/api/guide` requests with a well-formed token | 20 | 300 | 10 min |
| `events` | valid `/api/events` posts | 120 | 3000 | 1 min |

Values are in `RATE_LIMIT_RULES`. Five lead attempts per 10 minutes leave room for retries after a transient failure. When a limit is hit:

- the form shows "Z vašeho připojení přišlo příliš mnoho pokusů…" and records `form_error` with category `rate_limited`;
- `/api/guide` answers 429 with `Retry-After`;
- `/api/events` answers 429 with no body.

**Global limits** are always active.

**Per-client limits** are active only when both of these hold:

- **Running on Vercel** (`VERCEL=1`). Vercel overwrites `x-forwarded-for` with the real client IP to prevent spoofing (Vercel docs, "Request headers"). Anywhere else that header can be forged, so it is ignored and only the global limits apply. This includes `next start` locally and a proxy placed in front of Vercel.
- **`RATE_LIMIT_SECRET` is set** to at least 32 random characters.

The stored client key is the first 32 hex characters of HMAC-SHA256(secret, IP). The IP itself is never stored or logged. The key is pseudonymous, not anonymous. Rows are deleted after 24 hours: about 1 in 100 limiter calls purges old rows, and `npm run retention:cleanup` deletes them too.

**If the limiter's database write fails, the request is allowed** (fail open) and `[rate-limit:<bucket>]` is logged with the error class and code. This keeps a limiter fault from locking out visitors. Every protected action needs the same database anyway, so a real outage fails there instead.

**Limitations:**

- Fixed windows allow up to twice a limit across a window boundary.
- Without per-client limits, one abuser can exhaust a global limit and block everyone for the rest of the window.
- A distributed attack from many IPs stays under per-client limits.
- Each counted request costs one database round trip.

### Platform rate limiting (Stage 6, not configured)

Vercel WAF rate limiting is available on all plans; Hobby allows one rate-limit rule per project, with windows of 10 s to 10 min and IP or JA4 keys. It stops traffic before it reaches the application. Suggested rule once deployed:

- **Condition:** request path starts with `/api/`.
- **Limit:** 120 requests per 60 seconds per IP. Action: 429.

Start with the **Log** action for a few days to check real traffic, then switch to 429. On Pro, add separate rules for POST requests to `/` and `/poplatky` (form submissions).

### Other measures

- A hidden honeypot field; a filled one is rejected without touching the database.
- A minimum fill time of 1.5 s. The timestamp comes from the browser, so a deliberate bot can fake it.
- Server-side validation of every field.
- `/api/events` rejects requests from another site's `Origin` (403), non-JSON content (415) and bodies over 2 KB (413). Requests without an `Origin` header are allowed, so this does not stop scripts outside a browser.
- Server actions use Next.js's built-in check that the `Origin` matches the host.
- **Not present:** CAPTCHA, bot detection, email verification. The form requires JavaScript.

## 8a. Security headers

Set in `next.config.ts` and verified on a local production build:

| Header | Scope | Value |
|---|---|---|
| `X-Content-Type-Options` | all | `nosniff` |
| `Referrer-Policy` | all | `strict-origin-when-cross-origin` |
| `Referrer-Policy` | `/dekujeme`, `/api/guide` | `no-referrer` |
| `X-Frame-Options` | all | `DENY` |
| `Content-Security-Policy` | all | `frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'` |
| `Permissions-Policy` | all | camera, microphone, geolocation, payment, usb and browsing-topics disabled |
| `Strict-Transport-Security` | all | `max-age=63072000` (no `includeSubDomains`, no preload) |
| `X-Robots-Tag` | `/dekujeme`, `/api/guide` | `noindex, nofollow` |

The CSP has no `script-src` or `style-src`: Next.js inline scripts would need nonces, which make every page dynamic. Adding a full CSP is a separate decision.

`/dekujeme` is rendered per request with `Cache-Control: private, no-cache, no-store`.

## 9. Logging

Server logs contain a scope and the error class and Postgres error code only. Error messages are not logged because they can include submitted values. Emails, tokens, request bodies and connection strings are never logged by the application.

## 10. Verification record

### Against the real Neon database

Done on 2026-10-14 with a local production build (`next start`) and headless Chrome.

- **`npm run db:check`** (read-only): connection OK, retention configuration valid, migration 001 applied.
- **Schema:** the live columns, constraints and indexes match the first `db/schema.sql` plus migration 001.
- **Smoke test** with one test address of the form `stage4-smoke-<random>@example.com`:
  - The submission redirected to plain `/dekujeme`, with no query string.
  - The access cookie was HttpOnly, Secure, SameSite=Strict, path `/`, with a 7-day lifetime, and could not be read by page scripts.
  - The PDF downloaded: 200, `application/pdf`, starts with `%PDF-`, `private, no-store`, `no-referrer`.
  - A repeat submission with the box unticked kept consent and the original consent timestamp. It replaced the stored token hash; the first token's hash is gone.
  - The database held one lead row, a `lead_created` (`new`) event and a `guide_download` event, a 7-day token, a 365-day retention date, and no non-hash tokens.
  - Without the cookie, and with a token in the query string, access was refused with the generic message.
  - Cross-origin, non-JSON and server-only event posts were rejected (403, 415, 400). A valid event was accepted (204).
  - The server log contained neither the address nor the cookie.
- **Not verified on Neon:** the rate limiter. Migration 002 was not applied, so it ran in fail-open mode (`[rate-limit:*]` 42P01 in the log) and the requests were allowed, as designed. Apply migration 002, then repeat the smoke test.
- **Not run on Neon:** `npm run retention:cleanup`, or any other deletion.

**Removing the smoke-test data** (run in the Neon SQL Editor when you are ready; it touches only the test rows):

```sql
delete from funnel_events
where session_id in (select session_id from leads where email like 'stage4-smoke-%@example.com')
   or utm_campaign = 'stage4-smoke';
delete from leads where email like 'stage4-smoke-%@example.com';
```

Events from the smoke run's second visit, which had no campaign and a session that is no longer on the lead, cannot be singled out. They expire after `FUNNEL_EVENT_RETENTION_DAYS`.

### In isolated tests only (PGlite)

These run in the test suite against PGlite, which is Postgres compiled to WebAssembly and running inside the test process:

- every SQL statement;
- schema and migration equivalence;
- deletion semantics for all retention categories;
- rate-limit enforcement, window reset and purge;
- token expiry.

## 11. Stage 6 deployment checklist

Not done. Each item must be completed and verified on the deployed environment:

1. Apply `db/migrations/002_rate_limits.sql` to Neon; `npm run db:check` must report all three tables.
2. Set all environment variables in Vercel (Production and Preview, separately): `DATABASE_URL`, the three `DATA_CONTROLLER_*`, `PRIVACY_NOTICE_VERSION`, the three retention periods, and `RATE_LIMIT_SECRET`. Preview deployments should use a separate Neon branch, not production data.
3. Schedule the retention cleanup. For example, a Vercel Cron Job calling a new endpoint protected by `CRON_SECRET` that runs `runRetentionCleanup` once a day, or a scheduled CI job running `npm run retention:cleanup` with production secrets.
   - It deletes leads past 30/365 days, events past 90 days and rate-limit rows past 24 hours, in whatever database it points to.
   - Do not claim deletion is scheduled until the job has run and its counts have been checked.
4. Configure the Vercel WAF rule from section 8, first in Log mode.
5. Repeat the smoke test from section 10 on the deployed URL, including a rate-limit check (6 quick submissions from one client must produce the "příliš mnoho pokusů" message).
6. Get the controller's confirmation of everything in section 4.

