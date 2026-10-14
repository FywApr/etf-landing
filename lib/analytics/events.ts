// Event dictionary and validation for first-party funnel analytics.
// Shared by the browser sender and the server. See docs/funnel.md.
//
// Everything here is an allow-list. Events never carry email addresses, form
// values, calculator inputs or results, tokens, IP addresses or user agents.

import { z } from "zod";

export const VARIANTS = ["compare", "fees"] as const;
export type Variant = (typeof VARIANTS)[number];

/** Pathnames an event may be attributed to. Query strings are never recorded. */
export const PAGE_PATHS = ["/", "/poplatky", "/dekujeme", "/ochrana-osobnich-udaju"] as const;
export type PagePath = (typeof PAGE_PATHS)[number];

export const CTA_PLACEMENTS = ["hero_primary", "hero_secondary", "header_nav"] as const;
export const CTA_TARGETS = ["comparison", "calculator", "guide"] as const;
export const FORM_ERROR_CATEGORIES = [
  "email_missing",
  "email_invalid",
  "unavailable",
  "rejected",
  "rate_limited",
  "server",
] as const;
export const LEAD_STATUSES = ["new", "refreshed"] as const;

const noProperties = z.strictObject({});

/** Events the browser may send, with the only properties each one accepts. */
export const clientEventProperties = {
  page_view: noProperties,
  comparison_view: noProperties,
  calculator_used: noProperties,
  cta_click: z.strictObject({
    placement: z.enum(CTA_PLACEMENTS),
    target: z.enum(CTA_TARGETS),
  }),
  form_start: noProperties,
  form_submit: noProperties,
  form_error: z.strictObject({ category: z.enum(FORM_ERROR_CATEGORIES) }),
} as const;

/** Events only the server may record. The public endpoint rejects these names. */
export const serverEventProperties = {
  lead_created: z.strictObject({ lead_status: z.enum(LEAD_STATUSES) }),
  guide_download: noProperties,
} as const;

export type ClientEventName = keyof typeof clientEventProperties;
export type ServerEventName = keyof typeof serverEventProperties;
export type EventName = ClientEventName | ServerEventName;

export const CLIENT_EVENT_NAMES = Object.keys(clientEventProperties) as ClientEventName[];
export const SERVER_EVENT_NAMES = Object.keys(serverEventProperties) as ServerEventName[];

export type ClientEventProperties<N extends ClientEventName> = z.infer<
  (typeof clientEventProperties)[N]
>;

export const UTM_KEYS = ["source", "medium", "campaign", "content", "term"] as const;
export type UtmKey = (typeof UTM_KEYS)[number];
export type Utm = Partial<Record<UtmKey, string>>;

// Campaign-style identifiers only. Excludes "@", spaces and other characters,
// so an email address or free text can never pass as a UTM value.
const UTM_VALUE_PATTERN = /^[A-Za-z0-9_.-]{1,80}$/;

/** Returns the value if it is a safe campaign identifier, otherwise undefined. */
export function sanitizeUtmValue(value: unknown): string | undefined {
  return typeof value === "string" && UTM_VALUE_PATTERN.test(value) ? value : undefined;
}

/** Reads utm_* parameters from a query string, dropping anything unsafe. */
export function utmFromSearchParams(params: URLSearchParams): Utm {
  const utm: Utm = {};
  for (const key of UTM_KEYS) {
    const value = sanitizeUtmValue(params.get(`utm_${key}`));
    if (value !== undefined) utm[key] = value;
  }
  return utm;
}

/** The pathname if it is a known page, otherwise undefined. */
export function sanitizePath(value: unknown): PagePath | undefined {
  return (PAGE_PATHS as readonly unknown[]).includes(value) ? (value as PagePath) : undefined;
}

/** Acquisition variant from the first pathname the visitor landed on. */
export function variantForLandingPath(pathname: string): Variant {
  return pathname === "/poplatky" ? "fees" : "compare";
}

const utmValue = z.string().regex(UTM_VALUE_PATTERN);
export const utmSchema = z.strictObject({
  source: utmValue.optional(),
  medium: utmValue.optional(),
  campaign: utmValue.optional(),
  content: utmValue.optional(),
  term: utmValue.optional(),
});

const envelope = {
  eventId: z.uuid(),
  sessionId: z.uuid(),
  variant: z.enum(VARIANTS),
  path: z.enum(PAGE_PATHS),
  utm: utmSchema.default({}),
};

const clientEventVariants = CLIENT_EVENT_NAMES.map((name) =>
  z.strictObject({
    ...envelope,
    name: z.literal(name),
    properties: clientEventProperties[name],
  }),
);

/** Schema for the public events endpoint. Unknown names and keys are rejected. */
export const clientEventSchema = z.discriminatedUnion("name", [
  clientEventVariants[0],
  ...clientEventVariants.slice(1),
]);

export type ClientEvent = z.infer<typeof clientEventSchema>;

/** Largest request body the events endpoint will read, in bytes. */
export const MAX_EVENT_BODY_BYTES = 2048;
