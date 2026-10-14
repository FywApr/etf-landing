import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  CLIENT_EVENT_NAMES,
  MAX_EVENT_BODY_BYTES,
  SERVER_EVENT_NAMES,
  clientEventSchema,
  sanitizePath,
  sanitizeUtmValue,
  utmFromSearchParams,
  variantForLandingPath,
} from "@/lib/analytics/events";
import { handleClientEventRequest } from "@/lib/analytics/store";
import type { SqlExecutor } from "@/lib/db";

function event(overrides: Record<string, unknown> = {}) {
  return {
    eventId: randomUUID(),
    sessionId: randomUUID(),
    name: "page_view",
    variant: "compare",
    path: "/",
    utm: {},
    properties: {},
    ...overrides,
  };
}

const accepts = (value: unknown) => clientEventSchema.safeParse(value).success;

describe("client event schema", () => {
  it("accepts every client event with its allowed properties", () => {
    const properties: Record<string, object> = {
      cta_click: { placement: "hero_primary", target: "comparison" },
      form_error: { category: "email_invalid" },
    };
    for (const name of CLIENT_EVENT_NAMES) {
      expect(accepts(event({ name, properties: properties[name] ?? {} }))).toBe(true);
    }
  });

  it.each(SERVER_EVENT_NAMES)("rejects the server-only event %s", (name) => {
    expect(accepts(event({ name }))).toBe(false);
    expect(accepts(event({ name, properties: { lead_status: "new" } }))).toBe(false);
  });

  it.each(["purchase", "", "PAGE_VIEW", "page_view ", 42, null])(
    "rejects unknown event name %j",
    (name) => {
      expect(accepts(event({ name }))).toBe(false);
    },
  );

  it("rejects unknown top-level keys", () => {
    expect(accepts(event({ email: "someone@example.com" }))).toBe(false);
    expect(accepts(event({ userAgent: "Mozilla/5.0" }))).toBe(false);
    expect(accepts(event({ occurredAt: "2020-01-01" }))).toBe(false);
  });

  it("rejects properties on events that take none", () => {
    expect(accepts(event({ name: "calculator_used", properties: { initialDeposit: 100000 } }))).toBe(
      false,
    );
    expect(accepts(event({ name: "calculator_used", properties: { finalValue: "1681029" } }))).toBe(
      false,
    );
    expect(accepts(event({ name: "form_submit", properties: { email: "a@b.cz" } }))).toBe(false);
  });

  it("rejects extra or free-text properties on events that take some", () => {
    const click = { placement: "hero_primary", target: "comparison" };
    expect(accepts(event({ name: "cta_click", properties: { ...click, label: "x" } }))).toBe(false);
    expect(accepts(event({ name: "cta_click", properties: { ...click, placement: "popup" } }))).toBe(
      false,
    );
    expect(accepts(event({ name: "cta_click", properties: { placement: "hero_primary" } }))).toBe(
      false,
    );
    expect(
      accepts(event({ name: "form_error", properties: { category: "user typed bad@email" } })),
    ).toBe(false);
  });

  it.each(["compare ", "control", "", null])("rejects variant %j", (variant) => {
    expect(accepts(event({ variant }))).toBe(false);
  });

  it.each(["not-a-uuid", "", 5, null])("rejects identifier %j", (id) => {
    expect(accepts(event({ eventId: id }))).toBe(false);
    expect(accepts(event({ sessionId: id }))).toBe(false);
  });

  it.each([
    "/dekujeme?t=abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ",
    "/api/guide",
    "/admin",
    "https://example.com/",
    "/poplatky/",
    "",
  ])("rejects path %j", (path) => {
    expect(accepts(event({ path }))).toBe(false);
  });

  it("rejects UTM values that could carry personal data or free text", () => {
    expect(accepts(event({ utm: { source: "someone@example.com" } }))).toBe(false);
    expect(accepts(event({ utm: { campaign: "spring sale" } }))).toBe(false);
    expect(accepts(event({ utm: { campaign: "x".repeat(81) } }))).toBe(false);
    expect(accepts(event({ utm: { referrer: "google" } }))).toBe(false);
  });

  it("accepts campaign-style UTM values", () => {
    expect(
      accepts(
        event({
          utm: { source: "meta", medium: "paid_social", campaign: "etf-fees.v2", content: "a", term: "etf" },
        }),
      ),
    ).toBe(true);
  });
});

describe("sanitisers", () => {
  it("keeps safe UTM values and drops everything else", () => {
    expect(sanitizeUtmValue("meta_ads-2026.q4")).toBe("meta_ads-2026.q4");
    for (const bad of ["", "a b", "me@example.com", "x".repeat(81), "<script>", "ř", 5, null, undefined]) {
      expect(sanitizeUtmValue(bad)).toBeUndefined();
    }
  });

  it("reads only utm_ parameters from a query string", () => {
    const utm = utmFromSearchParams(
      new URLSearchParams(
        "utm_source=meta&utm_campaign=fees&utm_content=me%40example.com&t=secret-token&email=a%40b.cz",
      ),
    );
    expect(utm).toEqual({ source: "meta", campaign: "fees" });
  });

  it("accepts only known pathnames", () => {
    expect(sanitizePath("/poplatky")).toBe("/poplatky");
    expect(sanitizePath("/dekujeme?t=token")).toBeUndefined();
    expect(sanitizePath("/unknown")).toBeUndefined();
    expect(sanitizePath(undefined)).toBeUndefined();
  });

  it("derives the acquisition variant from the landing path", () => {
    expect(variantForLandingPath("/")).toBe("compare");
    expect(variantForLandingPath("/poplatky")).toBe("fees");
    expect(variantForLandingPath("/dekujeme")).toBe("compare");
  });
});

describe("public events endpoint", () => {
  const okSql = () => vi.fn<SqlExecutor>(async () => []);

  it("stores a valid event with parameters, never interpolated SQL", async () => {
    const sql = okSql();
    const payload = event({ name: "cta_click", properties: { placement: "header_nav", target: "guide" } });
    expect(await handleClientEventRequest(JSON.stringify(payload), sql)).toBe(204);
    const inserts = sql.mock.calls.filter(([text]) => text.includes("insert into funnel_events"));
    expect(inserts).toHaveLength(1);
    const [text, params] = inserts[0];
    expect(text).toContain("on conflict (event_id) do nothing");
    expect(text).not.toContain(payload.sessionId);
    expect(params).toContain(payload.sessionId);
    expect(params).toContain('{"placement":"header_nav","target":"guide"}');
  });

  it.each([
    ["server-only event", JSON.stringify(event({ name: "lead_created", properties: { lead_status: "new" } }))],
    ["guide_download", JSON.stringify(event({ name: "guide_download" }))],
    ["malformed JSON", "{not json"],
    ["an array", "[]"],
    ["empty body", ""],
    ["PII in properties", JSON.stringify(event({ properties: { email: "a@b.cz" } }))],
  ])("rejects %s without touching the database", async (_name, body) => {
    const sql = okSql();
    expect(await handleClientEventRequest(body, sql)).toBe(400);
    expect(sql).not.toHaveBeenCalled();
  });

  it("rejects an oversized body before parsing it", async () => {
    const sql = okSql();
    const body = JSON.stringify(event({ padding: "x".repeat(MAX_EVENT_BODY_BYTES) }));
    expect(await handleClientEventRequest(body, sql)).toBe(413);
    expect(sql).not.toHaveBeenCalled();
  });

  it("answers 429 and stores nothing when the events rate limit is exceeded", async () => {
    const sql = vi.fn<SqlExecutor>(async (text) =>
      text.includes("rate_limits") ? [{ client_key: "*", hits: 100000, seconds_left: 10 }] : [],
    );
    expect(await handleClientEventRequest(JSON.stringify(event()), sql)).toBe(429);
    expect(sql.mock.calls.some(([text]) => text.includes("insert into funnel_events"))).toBe(false);
  });

  it("reports unavailability when no database is configured", async () => {
    expect(await handleClientEventRequest(JSON.stringify(event()), null)).toBe(503);
  });

  it("still validates when no database is configured", async () => {
    expect(await handleClientEventRequest(JSON.stringify(event({ name: "nope" })), null)).toBe(400);
  });
});
