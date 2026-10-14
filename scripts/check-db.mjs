// Checks the database connection and schema without printing any credentials.
// Usage: npm run db:check   (reads DATABASE_URL from .env.local)

import { neon } from "@neondatabase/serverless";
import { getRetentionConfig } from "../lib/retention.ts";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Add it to .env.local.");
  process.exit(1);
}

const expected = ["funnel_events", "leads"];

// Configuration problems are reported by variable name only, never by value.
const retention = getRetentionConfig(process.env);
console.log(
  retention.ok
    ? "Retention policy: OK"
    : `Retention policy: INVALID - missing or invalid ${retention.missing.join(", ")}`,
);

try {
  const sql = neon(url);
  const rows = await sql.query(
    "select table_name from information_schema.tables where table_schema = current_schema() and table_name = any($1) order by table_name",
    [expected],
  );
  const found = rows.map((row) => row.table_name);
  console.log("Connection: OK");
  for (const table of expected) {
    console.log(`Table ${table}: ${found.includes(table) ? "found" : "MISSING - apply db/schema.sql"}`);
  }
  const [{ nullable }] = await sql.query(
    "select is_nullable as nullable from information_schema.columns where table_schema = current_schema() and table_name = 'leads' and column_name = 'retention_expires_at'",
  );
  const migrated = nullable === "NO";
  console.log(`Migration 001 (bounded retention): ${migrated ? "applied" : "NOT APPLIED - run db/migrations/001_bounded_retention.sql"}`);
  process.exit(found.length === expected.length && migrated && retention.ok ? 0 : 1);
} catch (error) {
  // The message may contain the host name; print only the error class and code.
  console.error("Connection: FAILED", error?.name ?? "", error?.code ?? "");
  process.exit(1);
}
