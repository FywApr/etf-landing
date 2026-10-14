// Data-retention policy: configuration and cleanup.
//
// This module is also run directly by Node (scripts/retention-cleanup.mjs), so
// it may import only packages and types: no "@/" aliases, no runtime imports
// of other project files, and only TypeScript syntax that Node can strip.

import { z } from "zod";
import type { SqlExecutor } from "./db";

export const RETENTION_DAYS_LIMITS = { min: 1, max: 3650 } as const;

/** Environment variable for each retention period. None has a default. */
export const RETENTION_ENV = {
  leadDays: "LEAD_RETENTION_DAYS",
  consentedLeadDays: "CONSENTED_LEAD_RETENTION_DAYS",
  funnelEventDays: "FUNNEL_EVENT_RETENTION_DAYS",
} as const;

export type RetentionKey = keyof typeof RETENTION_ENV;
export type RetentionConfig = Record<RetentionKey, number>;

type Env = Record<string, string | undefined>;

/** A whole number of days within the limits, written as plain digits. */
export const retentionDaysSchema = z
  .string()
  .trim()
  .regex(/^\d+$/)
  .transform(Number)
  .pipe(z.number().int().min(RETENTION_DAYS_LIMITS.min).max(RETENTION_DAYS_LIMITS.max));

export type RetentionResult =
  | { ok: true; config: RetentionConfig }
  | { ok: false; missing: string[] };

/**
 * Reads all three retention periods. Missing or invalid values are reported by
 * variable name; there is no fallback, so absent configuration can never mean
 * "keep forever".
 */
export function getRetentionConfig(env: Env = process.env): RetentionResult {
  const config: Partial<RetentionConfig> = {};
  const missing: string[] = [];
  for (const key of Object.keys(RETENTION_ENV) as RetentionKey[]) {
    const parsed = retentionDaysSchema.safeParse(env[RETENTION_ENV[key]] ?? "");
    if (parsed.success) config[key] = parsed.data;
    else missing.push(RETENTION_ENV[key]);
  }
  if (missing.length > 0) return { ok: false, missing: missing.sort() };
  return { ok: true, config: config as RetentionConfig };
}

// A lead's last activity is its most recent successful guide request, which is
// when the application sets updated_at. A lead is due for deletion when either
// its stored retention date has passed, or its last activity is older than the
// currently configured period for its consent state. The second condition means
// a shortened period also applies to leads saved under a longer one.
//
// Each statement deletes at most one batch and runs atomically on its own; the
// Neon HTTP driver has no interactive transactions, so batches are separate.
export const DELETE_EXPIRED_LEADS_SQL = `
  with due as (
    select id from leads
    where retention_expires_at < now()
       or updated_at < now() - make_interval(
            days => case when marketing_consent then $2::int else $1::int end)
    order by updated_at
    limit $3::int
    for update skip locked
  ),
  deleted as (
    delete from leads where id in (select id from due) returning 1
  )
  select count(*)::int as deleted from deleted`;

// Events are removed by age alone, whether or not a related lead still exists.
export const DELETE_EXPIRED_EVENTS_SQL = `
  with due as (
    select id from funnel_events
    where occurred_at < now() - make_interval(days => $1::int)
    order by occurred_at
    limit $2::int
    for update skip locked
  ),
  deleted as (
    delete from funnel_events where id in (select id from due) returning 1
  )
  select count(*)::int as deleted from deleted`;

export interface CleanupOptions {
  batchSize?: number;
  /** Upper bound on batches per table, so one run cannot loop forever. */
  maxBatches?: number;
}

export interface CleanupResult {
  ok: boolean;
  leadsDeleted: number;
  eventsDeleted: number;
  /** False if a table still had expired rows when maxBatches was reached. */
  complete: boolean;
  /** Which step failed, when ok is false. Never contains row data. */
  failedStep?: "leads" | "events";
  error?: unknown;
}

async function deleteInBatches(
  run: () => Promise<number>,
  batchSize: number,
  maxBatches: number,
): Promise<{ deleted: number; complete: boolean }> {
  let deleted = 0;
  for (let batch = 0; batch < maxBatches; batch += 1) {
    const count = await run();
    deleted += count;
    if (count < batchSize) return { deleted, complete: true };
  }
  return { deleted, complete: false };
}

/**
 * Deletes expired leads, then expired funnel events. Returns counts only. On a
 * database error it stops and reports how far it got; rows already deleted in
 * earlier batches stay deleted.
 */
export async function runRetentionCleanup(
  sql: SqlExecutor,
  config: RetentionConfig,
  { batchSize = 1000, maxBatches = 100 }: CleanupOptions = {},
): Promise<CleanupResult> {
  const count = (rows: Record<string, unknown>[]) => Number(rows[0]?.deleted ?? 0);
  const result: CleanupResult = { ok: true, leadsDeleted: 0, eventsDeleted: 0, complete: true };

  try {
    const leads = await deleteInBatches(
      async () =>
        count(
          await sql(DELETE_EXPIRED_LEADS_SQL, [
            config.leadDays,
            config.consentedLeadDays,
            batchSize,
          ]),
        ),
      batchSize,
      maxBatches,
    );
    result.leadsDeleted = leads.deleted;
    result.complete &&= leads.complete;
  } catch (error) {
    return { ...result, ok: false, complete: false, failedStep: "leads", error };
  }

  try {
    const events = await deleteInBatches(
      async () => count(await sql(DELETE_EXPIRED_EVENTS_SQL, [config.funnelEventDays, batchSize])),
      batchSize,
      maxBatches,
    );
    result.eventsDeleted = events.deleted;
    result.complete &&= events.complete;
  } catch (error) {
    return { ...result, ok: false, complete: false, failedStep: "events", error };
  }

  return result;
}
