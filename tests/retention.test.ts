// Retention policy: configuration, cleanup, timing, migration and docs.
// SQL runs against in-process Postgres (PGlite), never a remote database.

import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { insertEvent } from "@/lib/analytics/store";
import type { SqlExecutor } from "@/lib/db";
import { generateGuideToken } from "@/lib/guide-token";
import { saveLead, type ValidLead } from "@/lib/leads";
import {
  DELETE_EXPIRED_EVENTS_SQL,
  DELETE_EXPIRED_LEADS_SQL,
  DELETE_EXPIRED_RATE_LIMITS_SQL,
  RETENTION_ENV,
  getRetentionConfig,
  runRetentionCleanup,
  type RetentionConfig,
} from "@/lib/retention";
import { TEST_ENV, createTestDatabase, readSql, type TestDatabase } from "./helpers/database";

const POLICY: RetentionConfig = { leadDays: 30, consentedLeadDays: 365, funnelEventDays: 90 };
const LEAD_CONFIG = {
  privacyNoticeVersion: "test-1",
  leadRetentionDays: POLICY.leadDays,
  consentedLeadRetentionDays: POLICY.consentedLeadDays,
};
const DAY_MS = 24 * 60 * 60 * 1000;
const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

function lead(email: string, marketingConsent = false): ValidLead {
  return {
    email,
    marketingConsent,
    variant: "compare",
    sessionId: randomUUID(),
    path: "/",
    utm: {},
  };
}

describe("retention configuration", () => {
  it("reads all three periods", () => {
    expect(getRetentionConfig(TEST_ENV)).toEqual({ ok: true, config: POLICY });
  });

  it("reports every missing period by name, with no fallback", () => {
    expect(getRetentionConfig({})).toEqual({
      ok: false,
      missing: [
        "CONSENTED_LEAD_RETENTION_DAYS",
        "FUNNEL_EVENT_RETENTION_DAYS",
        "LEAD_RETENTION_DAYS",
      ],
    });
  });

  it.each(Object.values(RETENTION_ENV))("rejects invalid values for %s", (name) => {
    for (const value of ["0", "-1", "3651", "1.5", "30 days", "1e2", "", "Infinity", "0x1e"]) {
      const result = getRetentionConfig({ ...TEST_ENV, [name]: value });
      expect(result).toEqual({ ok: false, missing: [name] });
    }
  });

  it("accepts the bounds and surrounding whitespace", () => {
    const result = getRetentionConfig({
      [RETENTION_ENV.leadDays]: "1",
      [RETENTION_ENV.consentedLeadDays]: "3650",
      [RETENTION_ENV.funnelEventDays]: " 90 ",
    });
    expect(result).toEqual({
      ok: true,
      config: { leadDays: 1, consentedLeadDays: 3650, funnelEventDays: 90 },
    });
  });
});

describe("retention in the database", () => {
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

  const emails = async () =>
    (await db.sql("select email from leads order by email", [])).map((row) => row.email);
  const eventCount = async () =>
    Number((await db.sql("select count(*)::int as n from funnel_events", []))[0].n);
  /** Moves a lead's last activity and stored retention date into the past. */
  const age = (email: string, days: number) =>
    db.sql(
      `update leads set
         updated_at = now() - make_interval(days => $2::int),
         retention_expires_at = retention_expires_at - make_interval(days => $2::int),
         guide_token_expires_at = now() + interval '1 day'
       where email = $1`,
      [email, days],
    );

  async function addEvent(daysAgo: number, sessionId: string = randomUUID()) {
    const eventId = randomUUID();
    await insertEvent(db.sql, {
      eventId,
      sessionId,
      name: "page_view",
      variant: "compare",
      path: "/",
      properties: {},
      utm: {},
    });
    await db.sql(
      "update funnel_events set occurred_at = now() - make_interval(days => $2::int) where event_id = $1",
      [eventId, daysAgo],
    );
  }

  describe("cleanup", () => {
    it("deletes leads without consent once their last guide request is 30 days old", async () => {
      for (const email of ["day29@example.com", "day31@example.com"]) {
        await saveLead(db.sql, lead(email), generateGuideToken().hash, LEAD_CONFIG);
      }
      await age("day29@example.com", 29);
      await age("day31@example.com", 31);

      const result = await runRetentionCleanup(db.sql, POLICY);

      expect(result).toMatchObject({ ok: true, leadsDeleted: 1, complete: true });
      expect(await emails()).toEqual(["day29@example.com"]);
    });

    it("deletes leads with consent once their last guide request is 365 days old", async () => {
      for (const email of ["day364@example.com", "day366@example.com"]) {
        await saveLead(db.sql, lead(email, true), generateGuideToken().hash, LEAD_CONFIG);
      }
      await age("day364@example.com", 364);
      await age("day366@example.com", 366);

      const result = await runRetentionCleanup(db.sql, POLICY);

      expect(result.leadsDeleted).toBe(1);
      expect(await emails()).toEqual(["day364@example.com"]);
    });

    it("keeps a consented lead that would be expired without consent", async () => {
      await saveLead(db.sql, lead("consented@example.com", true), generateGuideToken().hash, LEAD_CONFIG);
      await age("consented@example.com", 200);
      await runRetentionCleanup(db.sql, POLICY);
      expect(await emails()).toEqual(["consented@example.com"]);
    });

    it("applies a shortened period to leads saved under a longer one", async () => {
      await saveLead(db.sql, lead("old-rule@example.com", true), generateGuideToken().hash, LEAD_CONFIG);
      await age("old-rule@example.com", 100);

      await runRetentionCleanup(db.sql, { ...POLICY, consentedLeadDays: 90 });

      expect(await emails()).toEqual([]);
    });

    it("deletes a lead whose stored retention date has passed", async () => {
      await saveLead(db.sql, lead("withdrawn@example.com"), generateGuideToken().hash, LEAD_CONFIG);
      await db.exec("update leads set retention_expires_at = now() - interval '1 minute'");
      await runRetentionCleanup(db.sql, POLICY);
      expect(await emails()).toEqual([]);
    });

    it("deletes funnel events older than 90 days even while their lead still exists", async () => {
      const input = lead("active@example.com", true);
      await saveLead(db.sql, input, generateGuideToken().hash, LEAD_CONFIG);
      await addEvent(91, input.sessionId);
      await addEvent(89, input.sessionId);
      await addEvent(200);

      const result = await runRetentionCleanup(db.sql, POLICY);

      expect(result.eventsDeleted).toBe(2);
      expect(await emails()).toEqual(["active@example.com"]);
      // The lead_created event from saveLead and the 89-day-old event remain.
      expect(await eventCount()).toBe(2);
    });

    it("keeps recent events of a lead that is deleted", async () => {
      const input = lead("gone@example.com");
      await saveLead(db.sql, input, generateGuideToken().hash, LEAD_CONFIG);
      await age("gone@example.com", 31);

      await runRetentionCleanup(db.sql, POLICY);

      expect(await emails()).toEqual([]);
      expect(await eventCount()).toBe(1);
    });

    it("deletes in bounded batches until nothing expired is left", async () => {
      for (let index = 0; index < 7; index += 1) await addEvent(100);
      await addEvent(10);

      const result = await runRetentionCleanup(db.sql, POLICY, { batchSize: 3 });

      expect(result).toMatchObject({ ok: true, eventsDeleted: 7, complete: true });
      expect(await eventCount()).toBe(1);
    });

    it("reports an incomplete run when the batch limit is reached", async () => {
      for (let index = 0; index < 7; index += 1) await addEvent(100);

      const result = await runRetentionCleanup(db.sql, POLICY, { batchSize: 2, maxBatches: 2 });

      expect(result).toMatchObject({ ok: true, eventsDeleted: 4, complete: false });
      expect(await eventCount()).toBe(3);
    });

    it("returns counts only, never row data", async () => {
      await saveLead(db.sql, lead("private@example.com"), generateGuideToken().hash, LEAD_CONFIG);
      await age("private@example.com", 40);

      const result = await runRetentionCleanup(db.sql, POLICY);

      expect(Object.keys(result).sort()).toEqual([
        "complete",
        "eventsDeleted",
        "leadsDeleted",
        "ok",
        "rateLimitRowsDeleted",
      ]);
      expect(JSON.stringify(result)).not.toContain("private");
    });

    it("matches the manual SQL file, which uses the proposed 30/365/90 days", async () => {
      const seed = async () => {
        await db.exec("delete from funnel_events; delete from leads;");
        for (const [email, consent, days] of [
          ["a@example.com", false, 29],
          ["b@example.com", false, 31],
          ["c@example.com", true, 364],
          ["d@example.com", true, 366],
        ] as const) {
          await saveLead(db.sql, lead(email, consent), generateGuideToken().hash, LEAD_CONFIG);
          await age(email, days);
        }
        await addEvent(89);
        await addEvent(91);
      };

      await seed();
      await runRetentionCleanup(db.sql, POLICY);
      const viaCommand = { leads: await emails(), events: await eventCount() };

      await seed();
      await db.exec(readSql("retention-cleanup.sql"));
      const viaSqlFile = { leads: await emails(), events: await eventCount() };

      expect(viaSqlFile).toEqual(viaCommand);
      expect(viaCommand.leads).toEqual(["a@example.com", "c@example.com"]);
    });
  });

  describe("timing of repeated guide requests", () => {
    const row = async (email: string) => (await db.sql("select * from leads where email = $1", [email]))[0];
    const daysFromNow = (value: unknown) => ((value as Date).getTime() - Date.now()) / DAY_MS;

    it("restarts the 30-day period from the latest request", async () => {
      await saveLead(db.sql, lead("again@example.com"), generateGuideToken().hash, LEAD_CONFIG);
      await age("again@example.com", 25);

      await saveLead(db.sql, lead("again@example.com"), generateGuideToken().hash, LEAD_CONFIG);

      const after = await row("again@example.com");
      expect(daysFromNow(after.updated_at)).toBeCloseTo(0, 2);
      expect(daysFromNow(after.retention_expires_at)).toBeCloseTo(30, 2);
      await age("again@example.com", 10);
      await runRetentionCleanup(db.sql, POLICY);
      expect(await emails()).toEqual(["again@example.com"]);
    });

    it("keeps consent and its timestamp on an unticked repeat request, and uses the consented period", async () => {
      await saveLead(db.sql, lead("keep@example.com", true), generateGuideToken().hash, LEAD_CONFIG);
      await age("keep@example.com", 300);
      await db.exec("update leads set marketing_consent_at = now() - interval '300 days'");
      const before = await row("keep@example.com");

      await saveLead(db.sql, lead("keep@example.com", false), generateGuideToken().hash, LEAD_CONFIG);

      const after = await row("keep@example.com");
      expect(after.marketing_consent).toBe(true);
      expect(after.marketing_consent_at).toEqual(before.marketing_consent_at);
      expect(daysFromNow(after.retention_expires_at)).toBeCloseTo(365, 2);
    });

    it("gives the token its own 7-day expiry, unaffected by the retention period", async () => {
      await saveLead(db.sql, lead("token@example.com", true), generateGuideToken().hash, LEAD_CONFIG);
      const saved = await row("token@example.com");
      expect(daysFromNow(saved.guide_token_expires_at)).toBeCloseTo(7, 2);
      expect(daysFromNow(saved.retention_expires_at)).toBeCloseTo(365, 2);
    });
  });
});

describe("cleanup failures", () => {
  it("stops at the failing step, reports counts so far, and exposes no message text to print", async () => {
    let calls = 0;
    const sql = vi.fn<SqlExecutor>(async (text) => {
      calls += 1;
      if (text === DELETE_EXPIRED_EVENTS_SQL) {
        throw Object.assign(new Error("row jana@example.com"), { code: "57014" });
      }
      return [{ deleted: 2 }];
    });

    const result = await runRetentionCleanup(sql, POLICY, { batchSize: 1000 });

    expect(result).toMatchObject({
      ok: false,
      leadsDeleted: 2,
      eventsDeleted: 0,
      complete: false,
      failedStep: "events",
    });
    expect(calls).toBe(2);
  });

  it("does not attempt event cleanup after lead cleanup fails", async () => {
    const sql = vi.fn<SqlExecutor>(async () => {
      throw new Error("connection refused");
    });
    const result = await runRetentionCleanup(sql, POLICY);
    expect(result).toMatchObject({ ok: false, failedStep: "leads", leadsDeleted: 0 });
    expect(sql).toHaveBeenCalledTimes(1);
    expect(sql.mock.calls[0][0]).toBe(DELETE_EXPIRED_LEADS_SQL);
  });

  it("passes every value as a parameter", async () => {
    const sql = vi.fn<SqlExecutor>(async () => [{ deleted: 0 }]);
    await runRetentionCleanup(sql, POLICY, { batchSize: 500 });
    expect(sql.mock.calls).toEqual([
      [DELETE_EXPIRED_LEADS_SQL, [30, 365, 500]],
      [DELETE_EXPIRED_EVENTS_SQL, [90, 500]],
      [DELETE_EXPIRED_RATE_LIMITS_SQL, [24, 500]],
    ]);
  });
});

describe("migrations", () => {
  async function shape(db: TestDatabase) {
    const columns = await db.sql(
      `select table_name, column_name, data_type, is_nullable, column_default
       from information_schema.columns
       where table_name in ('leads', 'funnel_events', 'rate_limits')
       order by table_name, column_name`,
      [],
    );
    const constraints = await db.sql(
      `select conrelid::regclass::text as t, conname, pg_get_constraintdef(oid) as def
       from pg_constraint
       where conrelid in (
         select oid from pg_class where relname in ('leads', 'funnel_events', 'rate_limits'))
       order by 1, 2`,
      [],
    );
    const indexes = await db.sql(
      `select indexname, indexdef from pg_indexes
       where tablename in ('leads', 'funnel_events', 'rate_limits') order by 1`,
      [],
    );
    return { columns, constraints, indexes };
  }

  it("upgrade the first schema to exactly the current fresh schema", async () => {
    const fresh = await createTestDatabase(["schema.sql"]);
    const migrated = await createTestDatabase([
      "tests/fixtures/schema-v1.sql",
      "migrations/001_bounded_retention.sql",
      "migrations/002_rate_limits.sql",
    ]);
    expect(await shape(migrated)).toEqual(await shape(fresh));
    await fresh.close();
    await migrated.close();
  });

  it("keeps existing rows, gives consented leads a date, and can be run twice", async () => {
    const db = await createTestDatabase(["tests/fixtures/schema-v1.sql"]);
    await db.exec(`
      insert into leads (email, guide_token_hash, guide_token_expires_at, updated_at,
        marketing_consent, marketing_consent_at, marketing_consent_text_version,
        privacy_notice_version, variant, session_id, retention_expires_at)
      values
        ('consented@example.com', '${"a".repeat(64)}', now() + interval '1 day', now() - interval '10 days',
         true, now() - interval '10 days', 'v1', 'v', 'compare', gen_random_uuid(), null),
        ('plain@example.com', '${"b".repeat(64)}', now() + interval '1 day', now() - interval '2 days',
         false, null, null, 'v', 'fees', gen_random_uuid(), now() + interval '28 days');
    `);

    await db.exec(readSql("migrations/001_bounded_retention.sql"));
    await db.exec(readSql("migrations/001_bounded_retention.sql"));

    const rows = await db.sql(
      `select email, marketing_consent,
         round(extract(epoch from retention_expires_at - updated_at) / 86400) as days
       from leads order by email`,
      [],
    );
    expect(rows).toEqual([
      { email: "consented@example.com", marketing_consent: true, days: "365" },
      { email: "plain@example.com", marketing_consent: false, days: "30" },
    ]);
    // The application's upsert works on the migrated database.
    await saveLead(db.sql, lead("consented@example.com", false), generateGuideToken().hash, LEAD_CONFIG);
    await db.close();
  });

  it("is required: the old schema rejects the new consented-lead upsert", async () => {
    const db = await createTestDatabase(["tests/fixtures/schema-v1.sql"]);
    await expect(
      saveLead(db.sql, lead("new@example.com", true), generateGuideToken().hash, LEAD_CONFIG),
    ).rejects.toThrow();
    await db.close();
  });

  it.each(["001_bounded_retention.sql", "002_rate_limits.sql"])(
    "%s contains no destructive statements",
    (file) => {
      const migration = read(`db/migrations/${file}`)
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .toLowerCase();
      expect(migration).not.toMatch(/\bdelete\b|\btruncate\b|drop\s+table|drop\s+column/);
    },
  );

  it("002 can be run twice and creates an empty table", async () => {
    const db = await createTestDatabase([
      "tests/fixtures/schema-v1.sql",
      "migrations/001_bounded_retention.sql",
    ]);
    await db.exec(readSql("migrations/002_rate_limits.sql"));
    await db.exec(readSql("migrations/002_rate_limits.sql"));
    expect(await db.sql("select count(*)::int as n from rate_limits", [])).toEqual([{ n: 0 }]);
    await db.close();
  });
});

describe("documentation matches the implemented policy", () => {
  const envExample = read(".env.example");
  const operations = read("docs/operations.md");
  const funnel = read("docs/funnel.md");
  const privacyPage = read("app/ochrana-osobnich-udaju/page.tsx");
  const manualSql = read("db/retention-cleanup.sql");

  it("proposes 30/365/90 days in .env.example and marks them provisional", () => {
    expect(envExample).toMatch(/^LEAD_RETENTION_DAYS=30$/m);
    expect(envExample).toMatch(/^CONSENTED_LEAD_RETENTION_DAYS=365$/m);
    expect(envExample).toMatch(/^FUNNEL_EVENT_RETENTION_DAYS=90$/m);
    expect(envExample).toContain("PROVISIONAL");
    expect(envExample).toMatch(/^DATABASE_URL=$/m);
  });

  it("uses the same proposed values in the manual SQL file", () => {
    expect(manualSql).toMatch(/30\s+=\s+LEAD_RETENTION_DAYS/);
    expect(manualSql).toMatch(/365\s+=\s+CONSENTED_LEAD_RETENTION_DAYS/);
    expect(manualSql).toMatch(/90\s+=\s+FUNNEL_EVENT_RETENTION_DAYS/);
  });

  it("documents every retention variable, both cleanup paths, and when the schedule counts as active", () => {
    for (const name of Object.values(RETENTION_ENV)) expect(operations).toContain(name);
    expect(operations).toContain("npm run retention:cleanup");
    expect(operations).toContain("/api/cron/retention");
    expect(operations).toContain("CRON_SECRET");
    expect(operations).toContain("The schedule is not active until");
    expect(operations).toContain("Vercel Cron calls only the production deployment");
    expect(envExample).toMatch(/^CRON_SECRET=$/m);
    expect(operations).toContain("must confirm them before public launch");
    expect(funnel).toContain("FUNNEL_EVENT_RETENTION_DAYS");
    expect(funnel).toContain("not anonymous");
  });

  it("shows all three configured periods in the privacy notice", () => {
    for (const field of ["leadRetentionDays", "consentedLeadRetentionDays", "funnelEventRetentionDays"]) {
      expect(privacyPage).toContain(`{${field}}`);
    }
  });

  it("does not call the events anonymous, claim legal review, or claim email sending", () => {
    expect(privacyPage).not.toMatch(/anonymní události|anonymních událost/);
    expect(privacyPage).toMatch(/nejsou\s+anonymní/);
    expect(privacyPage).toContain("žádné marketingové e-maily neodesílá");
    expect(privacyPage).not.toMatch(/GDPR|právně posouzen|plně v souladu/i);
  });
});
