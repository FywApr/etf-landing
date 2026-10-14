// Lead capture: validation and persistence. Framework-free so it can be tested
// with injected dependencies; the server action in app/actions wraps it.

import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  VARIANTS,
  sanitizePath,
  sanitizeUtmValue,
  type Utm,
  type Variant,
} from "@/lib/analytics/events";
import { getLeadCaptureConfig, type LeadCaptureConfig } from "@/lib/config";
import { MARKETING_CONSENT } from "@/lib/consent";
import { createSqlExecutor, type SqlExecutor } from "@/lib/db";
import { GUIDE_TOKEN_TTL_DAYS, generateGuideToken, type GuideToken } from "@/lib/guide-token";
import type { LeadErrorCode } from "@/lib/lead-form";
import { logServerError } from "@/lib/log";

export type LeadResult = { ok: true; token: string } | { ok: false; error: LeadErrorCode };

/** A submission faster than this after the form appeared is treated as automated. */
export const MIN_FILL_MS = 1500;

/** Trims and lower-cases, then validates. The result is what gets stored. */
export const emailSchema = z.string().trim().toLowerCase().min(1).max(254).pipe(z.email());

/** Raw field values as they arrive from the form. Nothing here is trusted. */
export interface LeadSubmission {
  email: unknown;
  marketingConsent: unknown;
  honeypot: unknown;
  startedAt: unknown;
  variant: unknown;
  sessionId: unknown;
  path: unknown;
  utm: Partial<Record<keyof Utm, unknown>>;
}

export interface LeadDeps {
  env?: Record<string, string | undefined>;
  now?: () => number;
  createSql?: (databaseUrl: string) => SqlExecutor;
  generateToken?: () => GuideToken;
}

// One statement, therefore atomic: the lead is created or refreshed and the
// matching lead_created event is recorded together, or neither happens.
//
// On a repeated email the token is replaced and the acquisition context is
// updated, but existing marketing consent is never cleared: an unticked box on
// a later submission is not a withdrawal. Ticking the box again for the same
// consent text keeps the original consent timestamp; only consent to a new text
// version is recorded as new consent.
//
// Every successful request sets updated_at (the lead's last activity) and a
// retention date counted from now: $14 days without consent, $17 days with it.
export const UPSERT_LEAD_SQL = `
  with upserted as (
    insert into leads
      (email, guide_token_hash, guide_token_expires_at,
       marketing_consent, marketing_consent_at, marketing_consent_text_version,
       privacy_notice_version, variant, session_id,
       utm_source, utm_medium, utm_campaign, utm_content, utm_term,
       retention_expires_at)
    values
      ($1, $2, now() + make_interval(days => $3::int),
       $4::boolean,
       case when $4::boolean then now() end,
       case when $4::boolean then $5::text end,
       $6, $7, $8::uuid,
       $9, $10, $11, $12, $13,
       now() + make_interval(days => case when $4::boolean then $17::int else $14::int end))
    on conflict (lower(email)) do update set
      guide_token_hash = excluded.guide_token_hash,
      guide_token_expires_at = excluded.guide_token_expires_at,
      updated_at = now(),
      marketing_consent = leads.marketing_consent or excluded.marketing_consent,
      marketing_consent_at = case
        when excluded.marketing_consent and not (
          leads.marketing_consent
          and leads.marketing_consent_text_version = excluded.marketing_consent_text_version)
        then excluded.marketing_consent_at
        else leads.marketing_consent_at end,
      marketing_consent_text_version = case
        when excluded.marketing_consent then excluded.marketing_consent_text_version
        else leads.marketing_consent_text_version end,
      privacy_notice_version = excluded.privacy_notice_version,
      variant = excluded.variant,
      session_id = excluded.session_id,
      utm_source = excluded.utm_source,
      utm_medium = excluded.utm_medium,
      utm_campaign = excluded.utm_campaign,
      utm_content = excluded.utm_content,
      utm_term = excluded.utm_term,
      retention_expires_at = now() + make_interval(days => case
        when leads.marketing_consent or excluded.marketing_consent then $17::int
        else $14::int end)
    returning (xmax = 0) as inserted
  ),
  recorded as (
    insert into funnel_events
      (event_id, session_id, name, variant, path, properties,
       utm_source, utm_medium, utm_campaign, utm_content, utm_term)
    select
      $15::uuid, $8::uuid, 'lead_created', $7, $16,
      jsonb_build_object('lead_status', case when inserted then 'new' else 'refreshed' end),
      $9, $10, $11, $12, $13
    from upserted
    on conflict (event_id) do nothing
  )
  select inserted from upserted`;

export interface ValidLead {
  email: string;
  marketingConsent: boolean;
  variant: Variant;
  sessionId: string;
  path: string;
  utm: Utm;
}

export async function saveLead(
  sql: SqlExecutor,
  lead: ValidLead,
  tokenHash: string,
  config: Pick<
    LeadCaptureConfig,
    "privacyNoticeVersion" | "leadRetentionDays" | "consentedLeadRetentionDays"
  >,
): Promise<{ isNew: boolean }> {
  const rows = await sql(UPSERT_LEAD_SQL, [
    lead.email,
    tokenHash,
    GUIDE_TOKEN_TTL_DAYS,
    lead.marketingConsent,
    lead.marketingConsent ? MARKETING_CONSENT.version : null,
    config.privacyNoticeVersion,
    lead.variant,
    lead.sessionId,
    lead.utm.source ?? null,
    lead.utm.medium ?? null,
    lead.utm.campaign ?? null,
    lead.utm.content ?? null,
    lead.utm.term ?? null,
    config.leadRetentionDays,
    randomUUID(),
    lead.path,
    config.consentedLeadRetentionDays,
  ]);
  return { isNew: rows[0]?.inserted === true };
}

const uuidSchema = z.uuid();

function parseAcquisition(submission: LeadSubmission) {
  // Analytics context must never block a real person: fall back, don't fail.
  const variant = (VARIANTS as readonly unknown[]).includes(submission.variant)
    ? (submission.variant as Variant)
    : "compare";
  const session = uuidSchema.safeParse(submission.sessionId);
  const utm: Utm = {};
  for (const key of Object.keys(submission.utm) as (keyof Utm)[]) {
    const value = sanitizeUtmValue(submission.utm[key]);
    if (value !== undefined) utm[key] = value;
  }
  return {
    variant,
    sessionId: session.success ? session.data : randomUUID(),
    path: sanitizePath(submission.path) ?? "/",
    utm,
  };
}

function looksAutomated(submission: LeadSubmission, now: number): boolean {
  if (typeof submission.honeypot === "string" && submission.honeypot.trim() !== "") return true;
  const startedAt = Number(submission.startedAt);
  if (!Number.isFinite(startedAt) || startedAt <= 0) return true;
  return now - startedAt < MIN_FILL_MS;
}

/**
 * Validates a submission and, only if the database and data-controller
 * configuration are complete, stores the lead and returns a guide token.
 * The outcome is identical for new and already-known addresses.
 */
export async function processLeadSubmission(
  submission: LeadSubmission,
  deps: LeadDeps = {},
): Promise<LeadResult> {
  const now = (deps.now ?? Date.now)();

  if (looksAutomated(submission, now)) return { ok: false, error: "rejected" };

  if (typeof submission.email !== "string" || submission.email.trim() === "") {
    return { ok: false, error: "email_missing" };
  }
  const email = emailSchema.safeParse(submission.email);
  if (!email.success) return { ok: false, error: "email_invalid" };

  // Checked before anything is stored: without a database and a named data
  // controller, personal data must not be accepted at all.
  const config = getLeadCaptureConfig(deps.env);
  if (!config.ok) {
    console.error("[lead] not configured, missing:", config.missing.join(", "));
    return { ok: false, error: "unavailable" };
  }

  const { token, hash } = (deps.generateToken ?? generateGuideToken)();
  try {
    const sql = (deps.createSql ?? createSqlExecutor)(config.config.databaseUrl);
    await saveLead(
      sql,
      {
        email: email.data,
        marketingConsent: submission.marketingConsent === true,
        ...parseAcquisition(submission),
      },
      hash,
      config.config,
    );
  } catch (error) {
    logServerError("lead", error);
    return { ok: false, error: "server" };
  }

  return { ok: true, token };
}
