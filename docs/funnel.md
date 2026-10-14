# Funnel analytics

First-party event tracking stored in the `funnel_events` table. No external analytics service, no cookies, no browser storage.

## Definitions

- **Session ID:** a random UUID created in the browser's memory on the first event of a page load. It survives client-side navigation (including the redirect to the thank-you page) and is lost on a full page reload or a new tab. It is not a visitor or device identifier.
- **Acquisition variant:** fixed for the session from the first pathname the visitor loads: `/poplatky` gives `fees`, every other path gives `compare`. Later navigation does not change it.
- **Path:** the pathname where the event happened, recorded separately from the variant. Only known pathnames are accepted; query strings are never recorded.
- **UTM values:** `utm_source`, `utm_medium`, `utm_campaign`, `utm_content` and `utm_term`, read once from the landing URL. A value is kept only if it matches `[A-Za-z0-9_.-]{1,80}`; anything else is dropped.

## Events

| Event | Sent by | When | Properties |
|---|---|---|---|
| `page_view` | Browser | First page load and each client-side route change | none |
| `comparison_view` | Browser | The comparison list first enters the upper 70% of the viewport; once per session | none |
| `calculator_used` | Browser | First change to any calculator input or fund selector; once per session | none |
| `cta_click` | Browser | A hero button or header navigation link is clicked | `placement`: `hero_primary`, `hero_secondary`, `header_nav`; `target`: `comparison`, `calculator`, `guide` |
| `form_start` | Browser | First focus inside the lead form; once per session | none |
| `form_submit` | Browser | The form passes client-side checks and is sent to the server | none |
| `form_error` | Browser | A client or server error is shown | `category`: `email_missing`, `email_invalid`, `unavailable`, `rejected`, `server` |
| `lead_created` | Server | In the same SQL statement that creates or refreshes the lead | `lead_status`: `new` or `refreshed` |
| `guide_download` | Server | After the token is validated and the PDF is generated | none |

The schemas are in `lib/analytics/events.ts`. The public endpoint `POST /api/events` accepts only the browser events; it rejects `lead_created` and `guide_download`, unknown names, unknown keys and unknown property values.

## What is never recorded

Email addresses, form field values, consent text, calculator inputs or results, guide tokens, token-bearing URLs, IP addresses and user-agent strings. The table has no columns for them and the schemas reject unknown keys.

**The events are not anonymous.** A lead row stores the session ID of its most recent guide request, so the events of that session can be linked to an email address by joining `leads.session_id`. This link is kept on purpose in this version, and the privacy notice says so. Events from sessions without a form submission carry no link to a person in this database.

## Funnel report

The query is in [`db/funnel-report.sql`](../db/funnel-report.sql); run it in the Neon SQL Editor. It returns one row per acquisition variant and campaign with the number of **distinct sessions** that reached each step:

| Column | Step |
|---|---|
| `visits` | at least one `page_view` |
| `viewed_comparison` | `comparison_view` |
| `used_calculator` | `calculator_used` |
| `clicked_cta` | `cta_click` |
| `started_form` | `form_start` |
| `submitted_form` | `form_submit` |
| `leads_saved` | `lead_created` (new or refreshed) |
| `new_leads` | `lead_created` with `lead_status = new` |
| `downloaded_guide` | `guide_download` |
| `visit_to_lead_pct` | `leads_saved` as a percentage of `visits` |

Sessions without a campaign are grouped as `(none)`. The default window is the last 30 days; change the `interval` in the first CTE. The marketing-consent rate is not an event; read it from the leads table:

```sql
select variant, count(*) as leads, count(*) filter (where marketing_consent) as consented
from leads group by variant;
```

## Limitations

- **Sessions, not people.** A reload or a return visit starts a new session, so `visits` overstates unique visitors and one person can appear in several sessions.
- **Steps are independent counts.** A session is counted at a step if it fired that event, whether or not it fired the earlier ones.
- **Downloads after a reload.** `guide_download` is attributed to the session stored on the lead. If the visitor reloads the thank-you page first, the download still counts for the session that submitted the form.
- **Lost events.** Events are sent with `navigator.sendBeacon` (falling back to `fetch`) and failures are ignored, so ad blockers and network errors cause undercounting. Browser events are also lost if `DATABASE_URL` is not configured.
- **Deduplication.** Each event carries a random `event_id` with a unique index; a repeated delivery of the same event is ignored. Two separate events with different IDs are both stored.
- **No rate limiting.** The endpoint validates and size-limits requests (2 KB) but does not limit their rate, and it does not verify that a request comes from a real browser. Anyone can post well-formed fake events. Before launch, add rate limiting at the platform level (for example the Vercel Firewall) and treat the numbers as indicative.
- **Timestamps** are set by the database when the event arrives, not by the browser.
- **Retention.** Events are deleted `FUNNEL_EVENT_RETENTION_DAYS` (proposed 90) days after `occurred_at` by `npm run retention:cleanup`; see `operations.md`. Reports therefore cover at most that window, and deleted events cannot be recovered for historical reports. Without that variable set, events are not recorded at all.
