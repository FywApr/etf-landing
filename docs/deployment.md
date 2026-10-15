# Deployment: Preview, Production and smoke tests

How to release the app on Vercel with Neon Postgres. Read [`operations.md`](operations.md) first; this file covers only the release. Nothing in it has been done until the owner records it as done.

Ground rules:

- **Production data is never used for tests.** Preview gets its own empty database. Destructive tests (cleanup, rate limits, test leads) run only on Preview.
- **Secrets go in the Vercel dashboard or `vercel env add`**, which prompts for the value so it never lands in shell history or a file. Mark them **Sensitive**. Never commit them; `.env*` (except `.env.example`) and `.vercel/` are ignored.
- **Environment-variable changes take effect only in a new deployment.** After adding or changing a variable, redeploy that environment.
- **Pushing to the Production branch deploys Production** if the GitHub repository is connected to the Vercel project. Release work goes on a separate branch until Production is approved.

## 1. Environment matrix

Derived from `.env.example`, `lib/config.ts`, `lib/retention.ts`, `lib/rate-limit.ts` and `lib/retention-job.ts`. `VERCEL` and `NODE_ENV` are set by Vercel, not by you.

| Variable | Local dev (`.env.local`) | Preview | Production | Notes |
|---|---|---|---|---|
| `DATABASE_URL` | dev or Preview branch | **Preview Neon branch** | Production Neon branch | Pooled string. Never the Production string in Preview. |
| `DATA_CONTROLLER_NAME` | required for the form | required for the form | required | The real controller, confirmed by them. Not a secret. |
| `DATA_CONTROLLER_ADDRESS` | required for the form | required for the form | required | |
| `DATA_CONTROLLER_EMAIL` | required for the form | required for the form | required | |
| `PRIVACY_NOTICE_VERSION` | required for the form | required for the form | required | Stored with every lead. |
| `LEAD_RETENTION_DAYS` | required | required | required | Provisional 30. |
| `CONSENTED_LEAD_RETENTION_DAYS` | required | required | required | Provisional 365. |
| `FUNNEL_EVENT_RETENTION_DAYS` | required | required | required | Provisional 90. Without it events are discarded. |
| `RATE_LIMIT_SECRET` | optional (unused off Vercel) | **own value** | **own value** | ≥ 32 chars. Without it only global limits apply. |
| `CRON_SECRET` | not needed | **own value**, only for the manual cleanup test | **required** | ≥ 32 chars. Vercel Cron sends it only to Production. |

Generate each secret separately with `openssl rand -base64 48`; Preview and Production must not share secret values.

If any form variable is missing, the deployment still works but the lead form answers "Formulář je dočasně nedostupný…" and stores nothing, and the privacy page says the policy is not published. That is the intended safe state. Do not fill in placeholder controller details to avoid it.

## 2. Neon: one branch per environment

**Production branch** (the existing database): already has `db/schema.sql`, migrations 001 and 002 per the owner. Confirm read-only:

```
npm run db:check            # with .env.local pointing at Production
```

All lines must say OK; it changes nothing. Do not run `npm run retention:cleanup` or any migration against it as part of testing.

**Preview database.** It must start **empty**. A normal Neon child branch copies the parent's rows, which would put real leads into Preview, so use one of:

1. A new Neon branch created with the **schema-only** option, if the console offers it for your plan; or
2. A separate Neon project (EU region) used only for Preview.

Do **not** enable automatic per-deployment preview branches (for example via the Neon–Vercel integration) unless they are schema-only: data-copying branches would copy Production leads into every Preview.

Then, on the Preview database only:

1. In the Neon SQL Editor, run `db/schema.sql`. A fresh database needs nothing else; it already matches migrations 001 and 002. (For a schema-only branch of an already migrated Production, the schema is copied and running `db/schema.sql` changes nothing.)
2. Put the Preview connection string and the Preview values in an ignored file such as `.env.preview.local` (matched by `.env*` in `.gitignore`), then run:

   ```
   node --env-file=.env.preview.local scripts/check-db.mjs
   ```

   Expect `Connection: OK`, both tables OK, migrations 001 and 002 OK, `Retention policy: OK`.

`db/migration-status.sql` gives the same answer when pasted into the Neon SQL Editor for either branch.

## 3. Vercel project

None of this is configured in the repository: there is no `.vercel/` link, and the Vercel CLI is not installed on the development machine.

1. Install and sign in (interactive):

   ```
   npm i -g vercel
   vercel login
   ```

2. Link the directory to the intended project. Choose the team and project yourself; do not accept a suggested new project unless that is intended.

   ```
   vercel link
   ```

3. In the dashboard, check **Settings → Git**: whether the GitHub repository is connected, and which branch is the **Production Branch**. If `main` is the Production Branch, pushing the release commit to `main` deploys Production.
4. **Settings → Environment Variables**: add each variable from section 1 per environment. Or, per variable, `vercel env add DATABASE_URL preview` (it prompts for the value). Check names, not values: `vercel env ls`.
5. **Settings → Deployment Protection**: Preview deployments are behind Vercel Authentication by default. For command-line smoke tests, either sign in through the browser first or create a **Protection Bypass for Automation** secret and send it as the `x-vercel-protection-bypass` header. Treat that value as a secret too.

Vercel builds Preview with `NODE_ENV=production` and `VERCEL=1`, so Preview behaves like Production: the guide cookie is `__Host-guide_access` with `Secure`, and per-client rate limits are active.

## 4. Step A: deploy Preview

Preconditions: the release changes are committed (or pushed to a non-production branch); `npm test`, `npm run typecheck`, `npm run lint` and `npm run build` pass; the Preview database passes `check-db`; Preview environment variables are set.

Either push a non-production branch (with Git integration), or:

```
vercel deploy
```

Copy the URL that the CLI prints or the dashboard shows. Do not construct one.

## 5. Preview smoke tests

Use synthetic data only, on the Preview URL (`$PREVIEW` below). Test addresses: `stage6-smoke-<random>@example.com`. Landing URLs: append `?utm_campaign=stage6-smoke`. If Deployment Protection is on, add `-H "x-vercel-protection-bypass: $BYPASS"` to every `curl`.

**Pages and headers**

```
curl -sI "$PREVIEW/"            # 200, nosniff, DENY, CSP frame-ancestors, Permissions-Policy, HSTS
curl -sI "$PREVIEW/poplatky"
curl -sI "$PREVIEW/dekujeme"    # Referrer-Policy: no-referrer, X-Robots-Tag: noindex, Cache-Control includes no-store
curl -sI "$PREVIEW/api/guide"   # 404 without cookie, private, no-store, no-referrer
```

**In a browser** (360 × 640, 390 × 800, 768, 1280, 1440 wide):

1. `/` shows "Americká ETF v jedné tabulce" with "Zobrazit srovnání"; `/poplatky` shows "Kolik vás stojí poplatky ETF za 20 let?" with the calculator directly below ([`ad-copy.md`](ad-copy.md)). No horizontal scrolling, no clipped controls.
2. The calculator: change amount, horizon and funds; enter an empty or out-of-range value and check the error text. RSP is labelled as an equal-weight strategy. Source links open issuer pages.
3. Submit the form empty and with an invalid address: Czech errors, nothing stored.
4. Submit a test address with the consent box **ticked**: redirect to plain `/dekujeme` (no query string). In DevTools → Application → Cookies: `__Host-guide_access`, HttpOnly, Secure, SameSite=Strict, path `/`, about 7 days.
5. Click "Stáhnout průvodce (PDF)": a PDF opens or downloads, with Czech diacritics intact.
6. Submit the **same** address again with the box **unticked**, then check in the Preview SQL Editor that `marketing_consent` is still true and `marketing_consent_at` unchanged.
7. In a private window (no cookie), open `/dekujeme` and `/api/guide`: the generic "not valid" page and a 404.
8. The privacy link in the form and footer opens `/ochrana-osobnich-udaju` with the controller and the three periods.

**Analytics endpoint**

```
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$PREVIEW/api/events" \
  -H "content-type: application/json" -H "origin: https://evil.example" -d '{}'          # 403
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$PREVIEW/api/events" -d 'x'          # 415
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$PREVIEW/api/events" \
  -H "content-type: application/json" \
  -d '{"eventId":"00000000-0000-4000-8000-000000000001","sessionId":"00000000-0000-4000-8000-000000000002","name":"lead_created","variant":"compare","path":"/","properties":{"lead_status":"new"}}'  # 400: server-only
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$PREVIEW/api/events" \
  -H "content-type: application/json" \
  -d '{"eventId":"00000000-0000-4000-8000-000000000003","sessionId":"00000000-0000-4000-8000-000000000002","name":"page_view","variant":"compare","path":"/","properties":{},"utm":{"campaign":"stage6-smoke"}}'  # 204: control
```

The last request is a positive control: if it does not return 204, the 400 above proves nothing.

Then in the SQL Editor, check that no event row contains an email or token:
`select count(*) from funnel_events where properties::text ~ '@|[A-Za-z0-9_-]{43}';` must be 0.

**Rate limiting (Preview only)**

From one browser, submit the form 6 times within 10 minutes with fresh test addresses. Submission 6 must show "Z vašeho připojení přišlo příliš mnoho pokusů…". Then confirm the per-client counter exists (a 32-hex `client_key`, not `*`):
`select bucket, client_key = '*' as global, hits from rate_limits order by window_start desc limit 5;`
If only global rows exist, per-client limiting is not active: check `RATE_LIMIT_SECRET` in Preview and redeploy. Vercel runtime logs must show no `[rate-limit:*]` errors; such errors mean the limiter is failing open, which is **not** enforcement.

**Scheduled cleanup endpoint**

Vercel Cron never calls Preview, so test it by hand with the **Preview** `CRON_SECRET`.

1. Unauthenticated: `curl -s -w " %{http_code}\n" "$PREVIEW/api/cron/retention"` → `{"ok":false,"error":"unauthorized"} 401`.
2. Wrong secret: same with `-H "authorization: Bearer wrong"` → 401.
3. In the **Preview** SQL Editor, create deliberately expired synthetic rows:

   ```sql
   -- Expired lead without consent (31 days since last guide request).
   insert into leads (email, guide_token_hash, guide_token_expires_at, updated_at, created_at,
     privacy_notice_version, variant, session_id, retention_expires_at, utm_campaign)
   values ('stage6-smoke-expired@example.com', encode(sha256('stage6-expired'::bytea), 'hex'),
     now() - interval '24 days', now() - interval '31 days', now() - interval '31 days',
     'stage6-smoke', 'compare', gen_random_uuid(), now() - interval '1 day', 'stage6-smoke');
   -- Expired funnel event (91 days old).
   insert into funnel_events (event_id, session_id, name, variant, path, occurred_at, utm_campaign)
   values (gen_random_uuid(), gen_random_uuid(), 'page_view', 'compare', '/',
     now() - interval '91 days', 'stage6-smoke');
   ```

4. Note the counts: `select count(*) from leads; select count(*) from funnel_events;`
5. Authorised call (the value is read from your environment, not typed into history):

   ```
   curl -s "$PREVIEW/api/cron/retention" -H "authorization: Bearer $PREVIEW_CRON_SECRET"
   ```

   Expect `"ok":true`, `leadsDeleted` ≥ 1, `eventsDeleted` ≥ 1, `"complete":true`, and nothing else.
6. Check that the expired test rows are gone and that the recent smoke-test lead from steps 4–6 above is still there.

**Logs.** In Vercel → Logs for the Preview deployment, search for the test address, `guide_access` and `stage6`: none may appear. Request paths must not contain tokens.

### Removing Preview smoke-test data

Run in the **Preview** SQL Editor:

```sql
delete from funnel_events
where session_id in (select session_id from leads where email like 'stage6-smoke-%@example.com')
   or utm_campaign = 'stage6-smoke';
delete from leads where email like 'stage6-smoke-%@example.com';
delete from rate_limits where window_start < now();
```

Events from smoke-test sessions without the campaign cannot be singled out; on Preview it is simpler to empty the tables (`truncate funnel_events, leads, rate_limits;`) **after double-checking the SQL Editor is on the Preview branch**.

## 6. Step B: Production

Do not deploy to Production until each item is done or explicitly accepted by the owner:

1. **Controller:** the real controller's name, address and contact email, confirmed by them, are in Production variables.
2. **Privacy notice and retention:** the controller has accepted the notice wording, the legal bases, the 30/365/90-day and 7-day periods (with up to about a day's delay from daily cleanup), the 24-hour rate-limit records, and the processor statement ([`operations.md`](operations.md), section 4). `PRIVACY_NOTICE_VERSION` matches the accepted text.
3. **Variables:** every Production variable in section 1, including `RATE_LIMIT_SECRET` and `CRON_SECRET`, with values different from Preview.
4. **Database:** `npm run db:check` against Production reports everything OK.
5. **Preview smoke tests** in section 5 passed.

Then deploy the same commit to Production, either by merging into the Production Branch (with Git integration) or with:

```
vercel deploy --prod
```

A fresh production build is used so that it picks up the Production variables.

## 7. Production verification (non-destructive)

1. `curl -sI` the four URLs from section 5: same headers; `/api/guide` 404 without a cookie.
2. `curl -s -w " %{http_code}\n" "$PRODUCTION/api/cron/retention"` → 401. **Do not** call it with the real secret as a test: it deletes real expired data.
3. **Settings → Cron Jobs** lists `/api/cron/retention` with `17 3 * * *`. After the next 03:00–03:59 UTC window, **View Logs** shows one invocation with status 200 and a `[retention-cron]` count line. Only then is the cleanup verified as running.
4. One real submission by the owner with their own address, if they accept that it is stored under the policy; delete it afterwards with the erasure query in `operations.md`, section 7.
5. Optional: configure the WAF rule from [`operations.md`](operations.md), section 8, in **Log** mode.

## 8. Rollback

**Deployments → previous production deployment → Instant Rollback.** The cron schedule follows the rolled-back deployment. Database migrations are forward-only and additive, so an older deployment works with the current schema.
