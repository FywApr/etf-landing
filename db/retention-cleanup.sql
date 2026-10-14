-- Manual retention cleanup for the Neon SQL Editor.
--
-- The same rules are run, in batches and with the configured values, by
-- `npm run retention:cleanup` (lib/retention.ts). Prefer that command. The
-- numbers below are the proposed periods; if the environment is configured
-- differently, change them to match before running.
--
--   30  = LEAD_RETENTION_DAYS            (leads without marketing consent)
--   365 = CONSENTED_LEAD_RETENTION_DAYS  (leads with marketing consent)
--   90  = FUNNEL_EVENT_RETENTION_DAYS    (funnel events)
--
-- A lead's last activity is its most recent guide request (updated_at).
-- Nothing schedules this automatically.

delete from leads
where retention_expires_at < now()
   or updated_at < now() - make_interval(
        days => case when marketing_consent then 365 else 30 end);

-- Events are removed by age, whether or not a related lead still exists.
delete from funnel_events
where occurred_at < now() - make_interval(days => 90);

-- Rate-limit counters (pseudonymous client keys) are kept for 24 hours.
delete from rate_limits
where window_start < now() - interval '24 hours';
