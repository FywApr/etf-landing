// Server-side configuration. Never import from a Client Component, and never
// expose any of these through NEXT_PUBLIC_ variables.

import { z } from "zod";
import { RETENTION_ENV, retentionDaysSchema } from "@/lib/retention";

type Env = Record<string, string | undefined>;

const nonEmpty = z.string().trim().min(1).max(300);

const controllerSchema = z.object({
  name: nonEmpty,
  address: nonEmpty,
  email: z.email().max(254),
});

const privacySchema = z.object({
  controller: controllerSchema,
  privacyNoticeVersion: z.string().trim().min(1).max(40),
  // No defaults on purpose: the data controller must choose every period.
  leadRetentionDays: retentionDaysSchema,
  consentedLeadRetentionDays: retentionDaysSchema,
  funnelEventRetentionDays: retentionDaysSchema,
});

export type DataController = z.infer<typeof controllerSchema>;
export type PrivacyConfig = z.infer<typeof privacySchema>;
export interface LeadCaptureConfig extends PrivacyConfig {
  databaseUrl: string;
}

export type ConfigResult<T> = { ok: true; config: T } | { ok: false; missing: string[] };

const ENV_NAMES = {
  "controller.name": "DATA_CONTROLLER_NAME",
  "controller.address": "DATA_CONTROLLER_ADDRESS",
  "controller.email": "DATA_CONTROLLER_EMAIL",
  privacyNoticeVersion: "PRIVACY_NOTICE_VERSION",
  leadRetentionDays: RETENTION_ENV.leadDays,
  consentedLeadRetentionDays: RETENTION_ENV.consentedLeadDays,
  funnelEventRetentionDays: RETENTION_ENV.funnelEventDays,
} as const;

/** Controller identity and all three retention periods. Needed by the privacy notice. */
export function getPrivacyConfig(env: Env = process.env): ConfigResult<PrivacyConfig> {
  const parsed = privacySchema.safeParse({
    controller: {
      name: env.DATA_CONTROLLER_NAME ?? "",
      address: env.DATA_CONTROLLER_ADDRESS ?? "",
      email: env.DATA_CONTROLLER_EMAIL ?? "",
    },
    privacyNoticeVersion: env.PRIVACY_NOTICE_VERSION ?? "",
    leadRetentionDays: env[RETENTION_ENV.leadDays] ?? "",
    consentedLeadRetentionDays: env[RETENTION_ENV.consentedLeadDays] ?? "",
    funnelEventRetentionDays: env[RETENTION_ENV.funnelEventDays] ?? "",
  });
  if (parsed.success) return { ok: true, config: parsed.data };

  const missing = new Set<string>();
  for (const issue of parsed.error.issues) {
    const key = issue.path.join(".") as keyof typeof ENV_NAMES;
    missing.add(ENV_NAMES[key] ?? key);
  }
  return { ok: false, missing: [...missing].sort() };
}

function isPostgresUrl(value: string | undefined): value is string {
  if (!value) return false;
  try {
    const { protocol } = new URL(value);
    return protocol === "postgres:" || protocol === "postgresql:";
  } catch {
    return false;
  }
}

export function getDatabaseUrl(env: Env = process.env): string | null {
  return isPostgresUrl(env.DATABASE_URL) ? env.DATABASE_URL : null;
}

/**
 * Database URL for recording funnel events, or null if events must not be
 * stored. Events are only collected while a retention period for them is set.
 */
export function getEventStoreUrl(env: Env = process.env): string | null {
  const days = retentionDaysSchema.safeParse(env[RETENTION_ENV.funnelEventDays] ?? "");
  return days.success ? getDatabaseUrl(env) : null;
}

/**
 * Everything required before any personal data may be stored. If anything is
 * missing or malformed the lead form must refuse to accept submissions.
 */
export function getLeadCaptureConfig(env: Env = process.env): ConfigResult<LeadCaptureConfig> {
  const privacy = getPrivacyConfig(env);
  const databaseUrl = getDatabaseUrl(env);
  const missing = [...(privacy.ok ? [] : privacy.missing), ...(databaseUrl ? [] : ["DATABASE_URL"])];
  if (!privacy.ok || !databaseUrl) return { ok: false, missing: missing.sort() };
  return { ok: true, config: { ...privacy.config, databaseUrl } };
}
