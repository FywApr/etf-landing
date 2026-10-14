-- Migration 001: bounded retention for leads with marketing consent.
--
-- Forward-only and non-destructive: no rows are deleted and no columns are
-- dropped. Safe to run more than once. Run it in the Neon SQL Editor on a
-- database created from the first version of db/schema.sql.
--
-- Before: a lead with marketing consent had no retention date and was kept
-- until consent was withdrawn.
-- After: every lead has a retention date. For consented leads it is the last
-- guide request plus CONSENTED_LEAD_RETENTION_DAYS.

-- 1. Remove the rule that consented leads must have no retention date.
alter table leads drop constraint if exists leads_retention_matches_consent;

-- 2. Give existing leads without a date one, counted from their last guide
--    request. 365 matches the proposed CONSENTED_LEAD_RETENTION_DAYS; if a
--    different value is configured, change it here before running.
update leads
set retention_expires_at = updated_at + interval '365 days'
where retention_expires_at is null;

-- 3. From now on every lead must have a retention date.
alter table leads alter column retention_expires_at set not null;

-- 4. Index for deleting funnel events by age.
create index if not exists funnel_events_occurred_at_idx on funnel_events (occurred_at);
