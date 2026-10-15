// Scheduled retention cleanup. app/api/cron/retention wraps this; Vercel Cron
// calls it once a day with "Authorization: Bearer <CRON_SECRET>". It runs the
// same runRetentionCleanup as `npm run retention:cleanup`, with the same
// configuration, so both paths apply one policy. See docs/operations.md, section 7.
//
// Responses and logs contain status and row counts only: never row data,
// emails, tokens, session IDs, configuration values or error messages.

import { createHash, timingSafeEqual } from "node:crypto";
import { getDatabaseUrl } from "@/lib/config";
import type { SqlExecutor } from "@/lib/db";
import { logServerError } from "@/lib/log";
import { getRetentionConfig, runRetentionCleanup, type CleanupOptions } from "@/lib/retention";

export const MIN_CRON_SECRET_LENGTH = 32;

type Env = Record<string, string | undefined>;

export interface CleanupJobResponse {
  status: 200 | 401 | 500 | 503;
  body: Record<string, unknown>;
}

/** Constant-time comparison of the Authorization header with the expected bearer value. */
export function isAuthorizedCronRequest(authorization: string | null, secret: string): boolean {
  if (!authorization) return false;
  // Hashing both sides gives equal lengths, so timingSafeEqual never throws
  // and the comparison time does not depend on the secret's length.
  const digest = (value: string) => createHash("sha256").update(value, "utf8").digest();
  return timingSafeEqual(digest(authorization), digest(`Bearer ${secret}`));
}

export async function handleRetentionCleanupRequest(
  authorization: string | null,
  env: Env,
  createSql: (databaseUrl: string) => SqlExecutor,
  options?: CleanupOptions,
): Promise<CleanupJobResponse> {
  // Without a usable secret the endpoint never runs, whoever calls it.
  const secret = env.CRON_SECRET;
  if (!secret || secret.length < MIN_CRON_SECRET_LENGTH) {
    console.error("[retention-cron] not run: CRON_SECRET missing or shorter than 32 characters");
    return { status: 503, body: { ok: false, error: "not_configured" } };
  }
  if (!isAuthorizedCronRequest(authorization, secret)) {
    return { status: 401, body: { ok: false, error: "unauthorized" } };
  }

  // Variable names (not values) are returned only to an authorised caller.
  const retention = getRetentionConfig(env);
  const databaseUrl = getDatabaseUrl(env);
  const missing = [...(retention.ok ? [] : retention.missing), ...(databaseUrl ? [] : ["DATABASE_URL"])];
  if (!retention.ok || !databaseUrl) {
    console.error(`[retention-cron] not run: missing or invalid ${missing.sort().join(", ")}`);
    return { status: 503, body: { ok: false, error: "not_configured", missing } };
  }

  const result = await runRetentionCleanup(createSql(databaseUrl), retention.config, options);
  const counts = {
    leadsDeleted: result.leadsDeleted,
    eventsDeleted: result.eventsDeleted,
    rateLimitRowsDeleted: result.rateLimitRowsDeleted,
    complete: result.complete,
  };

  if (!result.ok) {
    logServerError(`retention-cron:${result.failedStep}`, result.error);
    return { status: 500, body: { ok: false, failedStep: result.failedStep, ...counts } };
  }
  console.log("[retention-cron]", JSON.stringify(counts));
  return { status: 200, body: { ok: true, ...counts } };
}
