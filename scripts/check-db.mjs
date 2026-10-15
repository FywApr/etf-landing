// Checks the database connection, schema and configuration without printing
// any values or credentials. Read-only: it changes nothing.
// Usage: npm run db:check   (reads .env.local)
// For another environment's file: node --env-file=<file> scripts/check-db.mjs

import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { getRetentionConfig } from "../lib/retention.ts";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

// Configuration problems are reported by variable name only, never by value.
const retention = getRetentionConfig(process.env);
const secretSet = (name) => (process.env[name]?.length ?? 0) >= 32;
// Per-client rate limiting needs a secret; without it only global limits apply.
console.log(
  secretSet("RATE_LIMIT_SECRET")
    ? "Per-client rate limiting secret: set (used only when running on Vercel)"
    : "Per-client rate limiting secret: NOT SET - only global limits will apply",
);
// Needed only where the scheduled cleanup runs (Vercel Production).
console.log(
  secretSet("CRON_SECRET")
    ? "Scheduled cleanup secret (CRON_SECRET): set"
    : "Scheduled cleanup secret (CRON_SECRET): NOT SET - /api/cron/retention will refuse to run",
);
console.log(
  retention.ok
    ? "Retention policy: OK"
    : `Retention policy: INVALID - missing or invalid ${retention.missing.join(", ")}`,
);

try {
  const sql = neon(url);
  const statusSql = readFileSync(new URL("../db/migration-status.sql", import.meta.url), "utf8");
  const [status] = await sql.query(statusSql);
  console.log("Connection: OK");
  const checks = [
    ["Table leads", status.has_leads, "MISSING - apply db/schema.sql"],
    ["Table funnel_events", status.has_funnel_events, "MISSING - apply db/schema.sql"],
    ["Migration 001 (bounded retention)", status.migration_001, "NOT APPLIED - run db/migrations/001_bounded_retention.sql"],
    ["Migration 002 (rate limits)", status.migration_002, "NOT APPLIED - run db/migrations/002_rate_limits.sql"],
  ];
  for (const [label, ok, fix] of checks) console.log(`${label}: ${ok ? "OK" : fix}`);
  process.exit(checks.every(([, ok]) => ok) && retention.ok ? 0 : 1);
} catch (error) {
  // The message may contain the host name; print only the error class and code.
  console.error("Connection: FAILED", error?.name ?? "", error?.code ?? "");
  process.exit(1);
}
