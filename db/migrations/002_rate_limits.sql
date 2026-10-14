-- Migration 002: table for rate-limit counters.
--
-- Additive only: creates a new, empty table and an index. Nothing existing is
-- changed or deleted. Safe to run more than once. Run it in the Neon SQL
-- Editor after migration 001.
--
-- Until it is applied the application still works: the rate limiter fails
-- open (allows requests) and logs "[rate-limit:...]" errors.

create table if not exists rate_limits (
  bucket text not null check (bucket in ('lead', 'guide', 'events')),
  client_key text not null check (client_key = '*' or client_key ~ '^[0-9a-f]{32}$'),
  window_start timestamptz not null,
  hits integer not null default 1 check (hits > 0),
  primary key (bucket, client_key, window_start)
);

create index if not exists rate_limits_window_start_idx on rate_limits (window_start);
