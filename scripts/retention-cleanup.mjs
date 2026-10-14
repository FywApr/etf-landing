// Deletes leads and funnel events past their retention period.
// Usage: npm run retention:cleanup   (reads .env.local)
//
// Prints counts only: never emails, session IDs, tokens or connection details.
// Exit code 0 on success, 1 on configuration or database failure.

import { neon } from "@neondatabase/serverless";
import { getRetentionConfig, runRetentionCleanup } from "../lib/retention.ts";

const retention = getRetentionConfig(process.env);
if (!retention.ok) {
  console.error(`Retention cleanup NOT run. Missing or invalid: ${retention.missing.join(", ")}`);
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Retention cleanup NOT run. Missing: DATABASE_URL");
  process.exit(1);
}

const { leadDays, consentedLeadDays, funnelEventDays } = retention.config;
console.log(
  `Policy: leads without consent ${leadDays} days, with consent ${consentedLeadDays} days, funnel events ${funnelEventDays} days.`,
);

const sql = neon(url);
const result = await runRetentionCleanup(
  async (text, params) => sql.query(text, [...params]),
  retention.config,
);

console.log(`Leads deleted: ${result.leadsDeleted}`);
console.log(`Funnel events deleted: ${result.eventsDeleted}`);
console.log(`Rate-limit counters deleted: ${result.rateLimitRowsDeleted}`);

if (!result.ok) {
  // Error messages can contain row data or the host name; print class and code only.
  const { error } = result;
  console.error(`Cleanup FAILED at step "${result.failedStep}":`, error?.name ?? "", error?.code ?? "");
  process.exit(1);
}
if (!result.complete) {
  console.log("More expired rows remain than one run deletes. Run the command again.");
}
