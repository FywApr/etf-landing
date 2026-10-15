-- Read-only schema status, used by `npm run db:check` and executed by the tests.
-- Returns one row. A migration counts as applied only when every change it
-- makes is present, so a partly applied migration is reported as NOT applied.
-- Safe to run in the Neon SQL Editor on any environment: it changes nothing.

select
  exists (
    select 1 from information_schema.tables
    where table_schema = current_schema() and table_name = 'leads'
  ) as has_leads,
  exists (
    select 1 from information_schema.tables
    where table_schema = current_schema() and table_name = 'funnel_events'
  ) as has_funnel_events,
  exists (
    select 1 from information_schema.tables
    where table_schema = current_schema() and table_name = 'rate_limits'
  ) as has_rate_limits,

  -- 001_bounded_retention.sql: old constraint dropped, retention date
  -- required, index on funnel_events.occurred_at.
  (
    exists (
      select 1 from information_schema.columns
      where table_schema = current_schema() and table_name = 'leads'
        and column_name = 'retention_expires_at' and is_nullable = 'NO'
    )
    and not exists (
      select 1 from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = current_schema() and t.relname = 'leads'
        and c.conname = 'leads_retention_matches_consent'
    )
    and exists (
      select 1 from pg_indexes
      where schemaname = current_schema() and indexname = 'funnel_events_occurred_at_idx'
    )
  ) as migration_001,

  -- 002_rate_limits.sql: rate_limits table and its window index.
  (
    exists (
      select 1 from information_schema.tables
      where table_schema = current_schema() and table_name = 'rate_limits'
    )
    and exists (
      select 1 from pg_indexes
      where schemaname = current_schema() and indexname = 'rate_limits_window_start_idx'
    )
  ) as migration_002;
