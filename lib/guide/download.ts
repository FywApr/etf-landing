// Token-protected guide download. Framework-free; app/api/guide wraps it.

import { randomUUID } from "node:crypto";
import { VARIANTS, sanitizeUtmValue, type Utm, type Variant } from "@/lib/analytics/events";
import { insertEvent } from "@/lib/analytics/store";
import type { SqlExecutor } from "@/lib/db";
import { hashGuideToken, isWellFormedGuideToken } from "@/lib/guide-token";
import { logServerError } from "@/lib/log";
import { checkRateLimit } from "@/lib/rate-limit";

export interface GuideAccess {
  sessionId: string;
  variant: Variant;
  utm: Utm;
}

const FIND_ACCESS_SQL = `
  select session_id, variant, utm_source, utm_medium, utm_campaign, utm_content, utm_term
  from leads
  where guide_token_hash = $1 and guide_token_expires_at > now()
  limit 1`;

/**
 * Looks a token up by its hash. Returns null for malformed, unknown and
 * expired tokens alike, so callers cannot tell these cases apart.
 */
export async function findGuideAccess(sql: SqlExecutor, token: unknown): Promise<GuideAccess | null> {
  if (!isWellFormedGuideToken(token)) return null;
  const [row] = await sql(FIND_ACCESS_SQL, [hashGuideToken(token)]);
  if (!row) return null;
  return {
    sessionId: String(row.session_id),
    variant: (VARIANTS as readonly unknown[]).includes(row.variant)
      ? (row.variant as Variant)
      : "compare",
    utm: {
      source: sanitizeUtmValue(row.utm_source),
      medium: sanitizeUtmValue(row.utm_medium),
      campaign: sanitizeUtmValue(row.utm_campaign),
      content: sanitizeUtmValue(row.utm_content),
      term: sanitizeUtmValue(row.utm_term),
    },
  };
}

export type GuideDownloadResult =
  | { status: "ok"; pdf: Buffer }
  | { status: "not_found" }
  | { status: "rate_limited"; retryAfterSeconds: number }
  | { status: "unavailable" };

export interface GuideDownloadDeps {
  sql: SqlExecutor | null;
  renderPdf: () => Promise<Buffer>;
  /** False when no event retention period is configured: then nothing is recorded. */
  recordEvent?: boolean;
  /** Pseudonymous client key for per-client rate limiting, or null. */
  clientKey?: string | null;
}

/**
 * Validates the token, then generates the PDF, then records guide_download.
 * The event is written only after both earlier steps succeed. If recording it
 * fails the visitor still gets the guide: losing one analytics row is better
 * than refusing a valid download.
 */
export async function handleGuideDownload(
  token: unknown,
  { sql, renderPdf, recordEvent = true, clientKey = null }: GuideDownloadDeps,
): Promise<GuideDownloadResult> {
  if (!isWellFormedGuideToken(token)) return { status: "not_found" };
  if (!sql) return { status: "unavailable" };

  const limit = await checkRateLimit(sql, "guide", clientKey);
  if (!limit.allowed) return { status: "rate_limited", retryAfterSeconds: limit.retryAfterSeconds };

  let access: GuideAccess | null;
  try {
    access = await findGuideAccess(sql, token);
  } catch (error) {
    logServerError("guide:lookup", error);
    return { status: "unavailable" };
  }
  if (!access) return { status: "not_found" };

  let pdf: Buffer;
  try {
    pdf = await renderPdf();
  } catch (error) {
    logServerError("guide:render", error);
    return { status: "unavailable" };
  }

  if (!recordEvent) return { status: "ok", pdf };

  try {
    await insertEvent(sql, {
      eventId: randomUUID(),
      sessionId: access.sessionId,
      name: "guide_download",
      variant: access.variant,
      path: "/api/guide",
      properties: {},
      utm: access.utm,
    });
  } catch (error) {
    logServerError("guide:event", error);
  }

  return { status: "ok", pdf };
}
