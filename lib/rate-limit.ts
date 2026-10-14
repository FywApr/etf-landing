// Fixed-window rate limiting stored in Postgres, shared by all server
// instances. See docs/operations.md, section 8.
//
// Two counters are checked per request in one statement:
//   - a global counter per bucket, always active;
//   - a per-client counter, only when a trustworthy client IP is available
//     (on Vercel, which overwrites x-forwarded-for) and RATE_LIMIT_SECRET is
//     set. The IP itself is never stored: only a keyed HMAC of it.

import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import type { SqlExecutor } from "@/lib/db";
import { logServerError } from "@/lib/log";
import { DELETE_EXPIRED_RATE_LIMITS_SQL, RATE_LIMIT_RECORD_HOURS } from "@/lib/retention";

export const RATE_LIMIT_RULES = {
  // Lead form submissions that reach the database.
  lead: { windowSeconds: 600, perClient: 5, global: 100 },
  // Guide downloads with a well-formed token.
  guide: { windowSeconds: 600, perClient: 20, global: 300 },
  // Valid browser analytics events.
  events: { windowSeconds: 60, perClient: 120, global: 3000 },
} as const;

export type RateLimitBucket = keyof typeof RATE_LIMIT_RULES;

export type RateLimitDecision =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

const GLOBAL_KEY = "*";
const MIN_SECRET_LENGTH = 32;
const PURGE_PROBABILITY = 0.01;

type Env = Record<string, string | undefined>;

export const RECORD_HITS_SQL = `
  insert into rate_limits (bucket, client_key, window_start, hits)
  select $1, key, to_timestamp(floor(extract(epoch from now()) / $3::int) * $3::int), 1
  from unnest($2::text[]) as key
  on conflict (bucket, client_key, window_start)
    do update set hits = rate_limits.hits + 1
  returning client_key, hits,
    ceil(extract(epoch from window_start + make_interval(secs => $3::int) - now()))::int
      as seconds_left`;

/**
 * A pseudonymous per-client key, or null when the client cannot be identified
 * reliably. Forwarding headers are trusted only on Vercel, which overwrites
 * x-forwarded-for; anywhere else a client could forge them, so only the global
 * limit applies there. The key is keyed with a secret, so it cannot be reversed
 * by hashing every IP address, but it still identifies a device or network for
 * as long as the record exists: it is not anonymous.
 */
export function clientKeyFromHeaders(headers: Headers, env: Env = process.env): string | null {
  if (env.VERCEL !== "1") return null;
  const secret = env.RATE_LIMIT_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) return null;
  const ip = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (!ip || isIP(ip) === 0) return null;
  return createHmac("sha256", secret).update(ip).digest("hex").slice(0, 32);
}

/** Whether per-client limiting can work with this configuration. */
export function perClientLimitingConfigured(env: Env = process.env): boolean {
  return (env.RATE_LIMIT_SECRET?.length ?? 0) >= MIN_SECRET_LENGTH;
}

/**
 * Records one hit and decides whether the request may proceed. If the counter
 * cannot be written the request is allowed (fail open) and the failure logged:
 * a limiter outage should not lock out real visitors, and every protected
 * action needs the same database anyway.
 */
export async function checkRateLimit(
  sql: SqlExecutor,
  bucket: RateLimitBucket,
  clientKey: string | null,
  random: () => number = Math.random,
): Promise<RateLimitDecision> {
  const rule = RATE_LIMIT_RULES[bucket];
  const keys = clientKey ? [GLOBAL_KEY, clientKey] : [GLOBAL_KEY];

  let rows: Record<string, unknown>[];
  try {
    rows = await sql(RECORD_HITS_SQL, [bucket, keys, rule.windowSeconds]);
    // Occasionally remove old counters so the table stays small even before
    // the scheduled cleanup exists. Only rate-limit rows are touched.
    if (random() < PURGE_PROBABILITY) {
      await sql(DELETE_EXPIRED_RATE_LIMITS_SQL, [RATE_LIMIT_RECORD_HOURS, 500]);
    }
  } catch (error) {
    logServerError(`rate-limit:${bucket}`, error);
    return { allowed: true };
  }

  for (const row of rows) {
    const limit = row.client_key === GLOBAL_KEY ? rule.global : rule.perClient;
    if (Number(row.hits) > limit) {
      return { allowed: false, retryAfterSeconds: Math.max(1, Number(row.seconds_left) || 1) };
    }
  }
  return { allowed: true };
}
