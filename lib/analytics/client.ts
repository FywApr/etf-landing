// Browser-side event sender.
//
// The session lives in this module's memory only: no cookies, localStorage or
// sessionStorage. It survives client-side navigation and resets on a full page
// reload, which is a known measurement limitation (see docs/funnel.md).

import {
  sanitizePath,
  utmFromSearchParams,
  variantForLandingPath,
  type ClientEventName,
  type ClientEventProperties,
  type Utm,
  type Variant,
} from "@/lib/analytics/events";

export interface AnalyticsSession {
  sessionId: string;
  /** Fixed by the first page of the visit; later navigation does not change it. */
  variant: Variant;
  utm: Utm;
}

const EVENTS_ENDPOINT = "/api/events";

let session: AnalyticsSession | null = null;
const firedOnce = new Set<ClientEventName>();

function randomId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // crypto.randomUUID needs a secure context; build a v4 UUID by hand otherwise.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Browser only. Created on first use from the landing URL. */
export function getSession(): AnalyticsSession {
  session ??= {
    sessionId: randomId(),
    variant: variantForLandingPath(window.location.pathname),
    utm: utmFromSearchParams(new URLSearchParams(window.location.search)),
  };
  return session;
}

type EventWithProperties = "cta_click" | "form_error";
type EventWithoutProperties = Exclude<ClientEventName, EventWithProperties>;

/** Sends an event without blocking the visitor. Failures are ignored. */
export function track(name: EventWithoutProperties): void;
export function track<N extends EventWithProperties>(
  name: N,
  properties: ClientEventProperties<N>,
): void;
export function track(name: ClientEventName, properties?: Record<string, string>): void {
  try {
    const path = sanitizePath(window.location.pathname);
    if (!path) return;
    const { sessionId, variant, utm } = getSession();
    const body = JSON.stringify({
      eventId: randomId(),
      sessionId,
      name,
      variant,
      path,
      utm,
      properties: properties ?? {},
    });
    const blob = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon?.(EVENTS_ENDPOINT, blob)) return;
    void fetch(EVENTS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Analytics must never break the page.
  }
}

/** Sends a property-less event at most once per session. */
export function trackOnce(name: "comparison_view" | "calculator_used" | "form_start"): void {
  if (firedOnce.has(name)) return;
  firedOnce.add(name);
  track(name);
}
