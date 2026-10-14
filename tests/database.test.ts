// Runs the real schema and the application's SQL against in-process Postgres
// (PGlite). This verifies the statements themselves; it is not a Neon test.

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { insertEvent, type StoredEvent } from "@/lib/analytics/store";
import { MARKETING_CONSENT } from "@/lib/consent";
import { findGuideAccess, handleGuideDownload } from "@/lib/guide/download";
import { GUIDE_TOKEN_TTL_DAYS, generateGuideToken } from "@/lib/guide-token";
import { saveLead, type ValidLead } from "@/lib/leads";
import { createTestDatabase, readSql, type TestDatabase } from "./helpers/database";

const CONFIG = {
  privacyNoticeVersion: "test-1",
  leadRetentionDays: 30,
  consentedLeadRetentionDays: 365,
};
const DAY_MS = 24 * 60 * 60 * 1000;

let db: TestDatabase;

beforeAll(async () => {
  db = await createTestDatabase();
});
afterAll(async () => {
  await db.close();
});
beforeEach(async () => {
  await db.exec("delete from funnel_events; delete from leads;");
});

function lead(overrides: Partial<ValidLead> = {}): ValidLead {
  return {
    email: "jana@example.com",
    marketingConsent: false,
    variant: "compare",
    sessionId: randomUUID(),
    path: "/",
    utm: { source: "meta", campaign: "launch" },
    ...overrides,
  };
}

async function leadRow(email = "jana@example.com") {
  const [row] = await db.sql("select * from leads where email = $1", [email]);
  return row;
}

const daysFromNow = (value: unknown) => ((value as Date).getTime() - Date.now()) / DAY_MS;

describe("schema", () => {
  it("can be applied twice without error or data loss", async () => {
    await saveLead(db.sql, lead(), generateGuideToken().hash, CONFIG);
    await db.exec(readSql("schema.sql"));
    expect(await leadRow()).toBeDefined();
  });

  it("refuses consent metadata that contradicts the consent flag", async () => {
    const insert = (consent: boolean, at: string, version: string | null, retention: string) =>
      db.sql(
        `insert into leads (email, guide_token_hash, guide_token_expires_at, marketing_consent,
           marketing_consent_at, marketing_consent_text_version, privacy_notice_version,
           variant, session_id, retention_expires_at)
         values ($1, $2, now() + interval '1 day', $3, ${at}, $4, 'v', 'compare', $5, ${retention})`,
        [`${randomUUID()}@example.com`, generateGuideToken().hash, consent, version, randomUUID()],
      );
    await expect(insert(false, "now()", null, "now() + interval '1 day'")).rejects.toThrow();
    await expect(insert(false, "null", "v1", "now() + interval '1 day'")).rejects.toThrow();
    await expect(insert(true, "null", "v1", "now() + interval '1 day'")).rejects.toThrow();
    await expect(insert(true, "now()", null, "now() + interval '1 day'")).rejects.toThrow();
    // Every lead must carry a deletion date, with or without consent.
    await expect(insert(true, "now()", "v1", "null")).rejects.toThrow();
    await expect(insert(false, "null", null, "null")).rejects.toThrow();
    await expect(insert(true, "now()", "v1", "now() + interval '1 day'")).resolves.toBeDefined();
    await expect(insert(false, "null", null, "now() + interval '1 day'")).resolves.toBeDefined();
  });

  it("refuses emails that are not normalised", async () => {
    const raw = (email: string) =>
      db.sql(
        `insert into leads (email, guide_token_hash, guide_token_expires_at, privacy_notice_version,
           variant, session_id, retention_expires_at)
         values ($1, $2, now() + interval '1 day', 'v', 'compare', $3, now() + interval '1 day')`,
        [email, generateGuideToken().hash, randomUUID()],
      );
    await expect(raw("Jana@Example.com")).rejects.toThrow();
    await expect(raw(" jana@example.com")).rejects.toThrow();
  });

  it("refuses unknown event names, variants and paths", async () => {
    const base: StoredEvent = {
      eventId: randomUUID(),
      sessionId: randomUUID(),
      name: "page_view",
      variant: "compare",
      path: "/",
      properties: {},
      utm: {},
    };
    await expect(insertEvent(db.sql, { ...base, name: "hacked" as never })).rejects.toThrow();
    await expect(insertEvent(db.sql, { ...base, variant: "other" as never })).rejects.toThrow();
    await expect(insertEvent(db.sql, { ...base, path: "/dekujeme?t=secret" })).rejects.toThrow();
    await expect(
      insertEvent(db.sql, { ...base, properties: { blob: "x".repeat(2000) } }),
    ).rejects.toThrow();
  });
});

describe("saving a lead", () => {
  it("creates the lead and its lead_created event together", async () => {
    const input = lead({ variant: "fees", path: "/poplatky" });
    const { hash } = generateGuideToken();

    expect(await saveLead(db.sql, input, hash, CONFIG)).toEqual({ isNew: true });

    const row = await leadRow();
    expect(row.guide_token_hash).toBe(hash);
    expect(row.marketing_consent).toBe(false);
    expect(row.marketing_consent_at).toBeNull();
    expect(row.marketing_consent_text_version).toBeNull();
    expect(row.privacy_notice_version).toBe("test-1");
    expect(row.variant).toBe("fees");
    expect(row.utm_campaign).toBe("launch");
    expect(daysFromNow(row.guide_token_expires_at)).toBeCloseTo(GUIDE_TOKEN_TTL_DAYS, 1);
    expect(daysFromNow(row.retention_expires_at)).toBeCloseTo(30, 1);

    const events = await db.sql("select * from funnel_events", []);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      name: "lead_created",
      session_id: input.sessionId,
      variant: "fees",
      path: "/poplatky",
      properties: { lead_status: "new" },
      utm_campaign: "launch",
    });
  });

  it("records consent with its timestamp, text version and the consented retention period", async () => {
    await saveLead(db.sql, lead({ marketingConsent: true }), generateGuideToken().hash, CONFIG);
    const row = await leadRow();
    expect(row.marketing_consent).toBe(true);
    expect(row.marketing_consent_at).toBeInstanceOf(Date);
    expect(row.marketing_consent_text_version).toBe(MARKETING_CONSENT.version);
    expect(daysFromNow(row.retention_expires_at)).toBeCloseTo(365, 1);
  });

  it("refreshes a known email instead of duplicating it, and replaces the token", async () => {
    const first = generateGuideToken();
    const second = generateGuideToken();
    await saveLead(db.sql, lead(), first.hash, CONFIG);
    const secondSession = randomUUID();

    const result = await saveLead(
      db.sql,
      lead({ sessionId: secondSession, variant: "fees", utm: { campaign: "retarget" } }),
      second.hash,
      CONFIG,
    );

    expect(result).toEqual({ isNew: false });
    expect(await db.sql("select id from leads", [])).toHaveLength(1);
    const row = await leadRow();
    expect(row.guide_token_hash).toBe(second.hash);
    expect(row.session_id).toBe(secondSession);
    expect(row.variant).toBe("fees");
    expect(row.utm_campaign).toBe("retarget");
    expect(row.utm_source).toBeNull();
    expect(await findGuideAccess(db.sql, first.token)).toBeNull();
    expect(await findGuideAccess(db.sql, second.token)).not.toBeNull();

    const statuses = await db.sql(
      "select properties ->> 'lead_status' as status from funnel_events order by occurred_at, status",
      [],
    );
    expect(statuses.map((row) => row.status).sort()).toEqual(["new", "refreshed"]);
  });

  it("does not clear existing consent when a later submission leaves the box unticked", async () => {
    await saveLead(db.sql, lead({ marketingConsent: true }), generateGuideToken().hash, CONFIG);
    const before = await leadRow();

    await saveLead(db.sql, lead({ marketingConsent: false }), generateGuideToken().hash, CONFIG);

    const after = await leadRow();
    expect(after.marketing_consent).toBe(true);
    expect(after.marketing_consent_at).toEqual(before.marketing_consent_at);
    expect(after.marketing_consent_text_version).toBe(MARKETING_CONSENT.version);
    expect(daysFromNow(after.retention_expires_at)).toBeCloseTo(365, 1);
  });

  it("keeps the original consent timestamp when the box is ticked again for the same text", async () => {
    await saveLead(db.sql, lead({ marketingConsent: true }), generateGuideToken().hash, CONFIG);
    await db.exec("update leads set marketing_consent_at = now() - interval '100 days'");
    const before = await leadRow();

    await saveLead(db.sql, lead({ marketingConsent: true }), generateGuideToken().hash, CONFIG);

    const after = await leadRow();
    expect(after.marketing_consent_at).toEqual(before.marketing_consent_at);
  });

  it("records new consent when the consent text version has changed", async () => {
    await saveLead(db.sql, lead({ marketingConsent: true }), generateGuideToken().hash, CONFIG);
    await db.exec(
      "update leads set marketing_consent_at = now() - interval '100 days', marketing_consent_text_version = 'old'",
    );

    await saveLead(db.sql, lead({ marketingConsent: true }), generateGuideToken().hash, CONFIG);

    const after = await leadRow();
    expect(after.marketing_consent_text_version).toBe(MARKETING_CONSENT.version);
    expect(-daysFromNow(after.marketing_consent_at)).toBeLessThan(0.01);
  });

  it("adds consent to an existing lead when it is given later", async () => {
    await saveLead(db.sql, lead({ marketingConsent: false }), generateGuideToken().hash, CONFIG);
    await saveLead(db.sql, lead({ marketingConsent: true }), generateGuideToken().hash, CONFIG);
    const row = await leadRow();
    expect(row.marketing_consent).toBe(true);
    expect(row.marketing_consent_at).toBeInstanceOf(Date);
    expect(daysFromNow(row.retention_expires_at)).toBeCloseTo(365, 1);
  });

  it("writes nothing at all if the event part of the statement fails", async () => {
    await expect(
      saveLead(db.sql, lead({ path: "/not-an-allowed-path" }), generateGuideToken().hash, CONFIG),
    ).rejects.toThrow();
    expect(await db.sql("select id from leads", [])).toHaveLength(0);
    expect(await db.sql("select id from funnel_events", [])).toHaveLength(0);
  });

  it("treats an email with SQL metacharacters as plain data", async () => {
    const email = "o'brien+x@example.com";
    await saveLead(db.sql, lead({ email }), generateGuideToken().hash, CONFIG);
    expect((await leadRow(email)).email).toBe(email);
  });
});

describe("guide access", () => {
  it("finds a lead by a valid token and returns its analytics context", async () => {
    const input = lead({ variant: "fees" });
    const { token, hash } = generateGuideToken();
    await saveLead(db.sql, input, hash, CONFIG);

    expect(await findGuideAccess(db.sql, token)).toMatchObject({
      sessionId: input.sessionId,
      variant: "fees",
      utm: { source: "meta", campaign: "launch" },
    });
  });

  it("returns nothing for unknown, malformed and expired tokens alike", async () => {
    const { token, hash } = generateGuideToken();
    await saveLead(db.sql, lead(), hash, CONFIG);

    expect(await findGuideAccess(db.sql, generateGuideToken().token)).toBeNull();
    expect(await findGuideAccess(db.sql, "short")).toBeNull();
    expect(await findGuideAccess(db.sql, hash)).toBeNull();

    await db.exec(
      "update leads set updated_at = now() - interval '9 days', guide_token_expires_at = now() - interval '1 second'",
    );
    expect(await findGuideAccess(db.sql, token)).toBeNull();
  });

  it("serves the guide and records guide_download for a valid token only", async () => {
    const input = lead();
    const { token, hash } = generateGuideToken();
    await saveLead(db.sql, input, hash, CONFIG);
    const renderPdf = async () => Buffer.from("%PDF-test");

    const ok = await handleGuideDownload(token, { sql: db.sql, renderPdf });
    expect(ok.status).toBe("ok");

    const denied = await handleGuideDownload(generateGuideToken().token, { sql: db.sql, renderPdf });
    expect(denied.status).toBe("not_found");

    const downloads = await db.sql("select * from funnel_events where name = 'guide_download'", []);
    expect(downloads).toHaveLength(1);
    expect(downloads[0]).toMatchObject({ session_id: input.sessionId, path: "/api/guide" });
  });
});

describe("funnel events", () => {
  it("stores a repeated event id only once", async () => {
    const event: StoredEvent = {
      eventId: randomUUID(),
      sessionId: randomUUID(),
      name: "cta_click",
      variant: "compare",
      path: "/",
      properties: { placement: "hero_primary", target: "comparison" },
      utm: {},
    };
    await insertEvent(db.sql, event);
    await insertEvent(db.sql, event);
    expect(await db.sql("select id from funnel_events", [])).toHaveLength(1);
  });

  it("has no column that could hold an email, IP address or user agent", async () => {
    const columns = await db.sql(
      "select column_name from information_schema.columns where table_name = 'funnel_events'",
      [],
    );
    const names = columns.map((column) => String(column.column_name));
    expect(names.sort()).toEqual(
      [
        "id", "event_id", "session_id", "name", "variant", "path", "occurred_at", "properties",
        "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
      ].sort(),
    );
  });

  it("reports distinct sessions per step, by variant and campaign", async () => {
    const add = (sessionId: string, name: StoredEvent["name"], variant: "compare" | "fees", campaign?: string, properties: Record<string, string> = {}) =>
      insertEvent(db.sql, {
        eventId: randomUUID(),
        sessionId,
        name,
        variant,
        path: name === "guide_download" ? "/api/guide" : "/",
        properties,
        utm: campaign ? { campaign } : {},
      });

    const [a, b, c] = [randomUUID(), randomUUID(), randomUUID()];
    // Session a: full funnel on the fees variant, campaign "launch".
    for (const name of ["page_view", "page_view", "calculator_used", "cta_click", "form_start", "form_submit"] as const) {
      await add(a, name, "fees", "launch");
    }
    await add(a, "lead_created", "fees", "launch", { lead_status: "new" });
    await add(a, "guide_download", "fees", "launch");
    await add(a, "guide_download", "fees", "launch");
    // Session b: same variant and campaign, stops after starting the form.
    for (const name of ["page_view", "comparison_view", "form_start"] as const) {
      await add(b, name, "fees", "launch");
    }
    // Session c: other variant, no campaign, a returning lead.
    await add(c, "page_view", "compare");
    await add(c, "form_submit", "compare");
    await add(c, "lead_created", "compare", undefined, { lead_status: "refreshed" });

    const rows = await db.sql(readSql("funnel-report.sql"), []);
    const pick = (variant: string) => rows.find((row) => row.variant === variant)!;

    expect(rows).toHaveLength(2);
    expect(pick("fees")).toMatchObject({ campaign: "launch" });
    expect(pick("compare")).toMatchObject({ campaign: "(none)" });
    const asNumbers = (row: Record<string, unknown>) =>
      Object.fromEntries(
        Object.entries(row)
          .filter(([key]) => key !== "variant" && key !== "campaign")
          .map(([key, value]) => [key, value === null ? null : Number(value)]),
      );
    expect(asNumbers(pick("fees"))).toEqual({
      visits: 2,
      viewed_comparison: 1,
      used_calculator: 1,
      clicked_cta: 1,
      started_form: 2,
      submitted_form: 1,
      leads_saved: 1,
      new_leads: 1,
      downloaded_guide: 1,
      visit_to_lead_pct: 50,
    });
    expect(asNumbers(pick("compare"))).toMatchObject({
      visits: 1,
      leads_saved: 1,
      new_leads: 0,
      downloaded_guide: 0,
      visit_to_lead_pct: 100,
    });
  });
});
