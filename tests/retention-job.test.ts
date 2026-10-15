// Scheduled retention cleanup endpoint, its Vercel Cron schedule, and the
// read-only migration status check. SQL runs against PGlite, never Neon.

import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/cron/retention/route";
import { insertEvent } from "@/lib/analytics/store";
import type { SqlExecutor } from "@/lib/db";
import { generateGuideToken } from "@/lib/guide-token";
import { saveLead } from "@/lib/leads";
import { handleRetentionCleanupRequest, isAuthorizedCronRequest } from "@/lib/retention-job";
import { TEST_ENV, createTestDatabase, readSql, type TestDatabase } from "./helpers/database";

const SECRET = "s".repeat(40);
const ENV = { ...TEST_ENV, CRON_SECRET: SECRET };
const AUTH = `Bearer ${SECRET}`;
const LEAD_CONFIG = {
  privacyNoticeVersion: "test-1",
  leadRetentionDays: 30,
  consentedLeadRetentionDays: 365,
};

describe("cron authorization", () => {
  it("accepts only the exact bearer value", () => {
    expect(isAuthorizedCronRequest(AUTH, SECRET)).toBe(true);
    for (const header of [null, "", SECRET, `bearer ${SECRET}`, `Bearer ${SECRET} `, `Bearer ${SECRET}x`, "Bearer "]) {
      expect(isAuthorizedCronRequest(header, SECRET)).toBe(false);
    }
  });

  it("never runs without a CRON_SECRET of at least 32 characters, even for a matching header", async () => {
    const createSql = vi.fn();
    for (const secret of [undefined, "", "short-secret"]) {
      const response = await handleRetentionCleanupRequest(
        `Bearer ${secret ?? ""}`,
        { ...TEST_ENV, CRON_SECRET: secret },
        createSql,
      );
      expect(response).toEqual({ status: 503, body: { ok: false, error: "not_configured" } });
    }
    expect(createSql).not.toHaveBeenCalled();
  });

  it("rejects a wrong or missing header without touching the database", async () => {
    const createSql = vi.fn();
    for (const header of [null, "Bearer wrong", SECRET]) {
      const response = await handleRetentionCleanupRequest(header, ENV, createSql);
      expect(response).toEqual({ status: 401, body: { ok: false, error: "unauthorized" } });
    }
    expect(createSql).not.toHaveBeenCalled();
  });

  it("refuses to run with missing retention or database configuration and names only the variables", async () => {
    const createSql = vi.fn();
    const response = await handleRetentionCleanupRequest(
      AUTH,
      { CRON_SECRET: SECRET, LEAD_RETENTION_DAYS: "30" },
      createSql,
    );
    expect(response).toEqual({
      status: 503,
      body: {
        ok: false,
        error: "not_configured",
        missing: ["CONSENTED_LEAD_RETENTION_DAYS", "DATABASE_URL", "FUNNEL_EVENT_RETENTION_DAYS"],
      },
    });
    expect(createSql).not.toHaveBeenCalled();
  });
});

describe("cron route", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("answers 401 to an unauthenticated request, uncached", async () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    const response = await GET(new Request("https://example.invalid/api/cron/retention"));
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ ok: false, error: "unauthorized" });
  });

  it("answers 503 when CRON_SECRET is not configured", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await GET(
      new Request("https://example.invalid/api/cron/retention", { headers: { authorization: "Bearer " } }),
    );
    expect(response.status).toBe(503);
    errors.mockRestore();
  });

  it("is scheduled once a day in vercel.json at the route's path", () => {
    const config = JSON.parse(readFileSync(path.join(process.cwd(), "vercel.json"), "utf8"));
    expect(config.crons).toEqual([{ path: "/api/cron/retention", schedule: expect.any(String) }]);
    // Minute and hour fixed, every day: valid on the Hobby plan (at most daily).
    expect(config.crons[0].schedule).toMatch(/^\d{1,2} \d{1,2} \* \* \*$/);
    expect(existsSync(path.join(process.cwd(), "app/api/cron/retention/route.ts"))).toBe(true);
  });
});

describe("cleanup through the endpoint", () => {
  let db: TestDatabase;
  const createSql = () => db.sql;

  beforeAll(async () => {
    db = await createTestDatabase();
  });
  afterAll(async () => {
    await db.close();
  });
  beforeEach(async () => {
    await db.exec("delete from funnel_events; delete from leads; delete from rate_limits;");
  });

  async function addLead(email: string, consent: boolean, daysAgo: number) {
    await saveLead(
      db.sql,
      { email, marketingConsent: consent, variant: "compare", sessionId: randomUUID(), path: "/", utm: {} },
      generateGuideToken().hash,
      LEAD_CONFIG,
    );
    await db.sql(
      `update leads set
         updated_at = now() - make_interval(days => $2::int),
         retention_expires_at = retention_expires_at - make_interval(days => $2::int),
         guide_token_expires_at = now() + interval '1 day'
       where email = $1`,
      [email, daysAgo],
    );
  }

  async function addEvent(daysAgo: number) {
    const eventId = randomUUID();
    await insertEvent(db.sql, {
      eventId,
      sessionId: randomUUID(),
      name: "page_view",
      variant: "fees",
      path: "/poplatky",
      properties: {},
      utm: {},
    });
    await db.sql(
      "update funnel_events set occurred_at = now() - make_interval(days => $2::int) where event_id = $1",
      [eventId, daysAgo],
    );
  }

  it("deletes only expired rows and returns counts only", async () => {
    // Expired: 31-day-old lead without consent, 366-day-old consented lead,
    // 91-day-old event, 25-hour-old rate-limit counter.
    await addLead("cron-expired-plain@example.invalid", false, 31);
    await addLead("cron-expired-consented@example.invalid", true, 366);
    // Must survive: recent leads of both kinds, a consented lead past 30 days.
    await addLead("cron-keep-plain@example.invalid", false, 29);
    await addLead("cron-keep-consented@example.invalid", true, 200);
    await db.exec("delete from funnel_events");
    await addEvent(91);
    await addEvent(89);
    await db.exec(`
      insert into rate_limits (bucket, client_key, window_start, hits) values
        ('lead', '*', now() - interval '25 hours', 1),
        ('lead', '*', now() - interval '1 hour', 1);
    `);

    const logs = vi.spyOn(console, "log").mockImplementation(() => {});
    const response = await handleRetentionCleanupRequest(AUTH, ENV, createSql);
    const logged = logs.mock.calls.flat().join(" ");
    logs.mockRestore();

    expect(response).toEqual({
      status: 200,
      body: { ok: true, leadsDeleted: 2, eventsDeleted: 1, rateLimitRowsDeleted: 1, complete: true },
    });
    const emails = (await db.sql("select email from leads order by email", [])).map((r) => r.email);
    expect(emails).toEqual(["cron-keep-consented@example.invalid", "cron-keep-plain@example.invalid"]);
    expect(await db.sql("select count(*)::int as n from funnel_events", [])).toEqual([{ n: 1 }]);
    expect(await db.sql("select count(*)::int as n from rate_limits", [])).toEqual([{ n: 1 }]);

    const exposed = JSON.stringify(response) + logged;
    expect(exposed).not.toContain("@");
    expect(exposed).not.toContain(SECRET);
    expect(exposed).not.toContain("postgresql://");
  });

  it("is safe to run twice (duplicate cron delivery)", async () => {
    await addLead("cron-expired-twice@example.invalid", false, 31);
    vi.spyOn(console, "log").mockImplementation(() => {});
    expect((await handleRetentionCleanupRequest(AUTH, ENV, createSql)).body.leadsDeleted).toBe(1);
    expect((await handleRetentionCleanupRequest(AUTH, ENV, createSql)).body).toMatchObject({
      ok: true,
      leadsDeleted: 0,
    });
    vi.restoreAllMocks();
  });

  it("reports a failure with step and counts, never the error message", async () => {
    const failing: SqlExecutor = async () => {
      throw Object.assign(new Error("duplicate key (email)=(someone@example.com)"), { code: "XX000" });
    };
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await handleRetentionCleanupRequest(AUTH, ENV, () => failing);
    const logged = errors.mock.calls.flat().join(" ");
    errors.mockRestore();

    expect(response).toEqual({
      status: 500,
      body: {
        ok: false,
        failedStep: "leads",
        leadsDeleted: 0,
        eventsDeleted: 0,
        rateLimitRowsDeleted: 0,
        complete: false,
      },
    });
    expect(logged).toContain("retention-cron:leads");
    expect(logged).not.toContain("someone@example.com");
  });
});

describe("migration status check", () => {
  const status = async (files: string[]) => {
    const db = await createTestDatabase(files);
    const [row] = await db.sql(readSql("migration-status.sql"), []);
    await db.close();
    return row;
  };

  it("reports a fresh schema as fully migrated", async () => {
    expect(await status(["schema.sql"])).toEqual({
      has_leads: true,
      has_funnel_events: true,
      has_rate_limits: true,
      migration_001: true,
      migration_002: true,
    });
  });

  it("reports the first schema as needing both migrations", async () => {
    expect(await status(["tests/fixtures/schema-v1.sql"])).toMatchObject({
      has_leads: true,
      migration_001: false,
      migration_002: false,
    });
  });

  it("reports 001 only after 001, and both after 002", async () => {
    expect(
      await status(["tests/fixtures/schema-v1.sql", "migrations/001_bounded_retention.sql"]),
    ).toMatchObject({ migration_001: true, migration_002: false });
    expect(
      await status([
        "tests/fixtures/schema-v1.sql",
        "migrations/001_bounded_retention.sql",
        "migrations/002_rate_limits.sql",
      ]),
    ).toMatchObject({ migration_001: true, migration_002: true });
  });

  it("does not report a partly applied 001 as applied", async () => {
    const db = await createTestDatabase(["tests/fixtures/schema-v1.sql"]);
    // Steps 1-3 of migration 001, without its index.
    await db.exec(`
      alter table leads drop constraint if exists leads_retention_matches_consent;
      update leads set retention_expires_at = updated_at + interval '365 days' where retention_expires_at is null;
      alter table leads alter column retention_expires_at set not null;
    `);
    const [row] = await db.sql(readSql("migration-status.sql"), []);
    expect(row.migration_001).toBe(false);
    await db.close();
  });

  it("does not report a rate_limits table without its index as migration 002", async () => {
    const db = await createTestDatabase(["tests/fixtures/schema-v1.sql", "migrations/001_bounded_retention.sql"]);
    await db.exec(readSql("migrations/002_rate_limits.sql"));
    await db.exec("drop index rate_limits_window_start_idx");
    const [row] = await db.sql(readSql("migration-status.sql"), []);
    expect(row).toMatchObject({ has_rate_limits: true, migration_002: false });
    await db.close();
  });

  it("is read-only", () => {
    const text = readSql("migration-status.sql")
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n")
      .toLowerCase();
    expect(text).not.toMatch(/\b(insert|update|delete|drop|alter|create|truncate)\b/);
  });
});
