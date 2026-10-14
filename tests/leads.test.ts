import { describe, expect, it, vi } from "vitest";
import { MARKETING_CONSENT } from "@/lib/consent";
import type { SqlExecutor } from "@/lib/db";
import { hashGuideToken } from "@/lib/guide-token";
import {
  MIN_FILL_MS,
  emailSchema,
  processLeadSubmission,
  type LeadDeps,
  type LeadSubmission,
} from "@/lib/leads";
import { TEST_ENV } from "./helpers/database";

const NOW = 1_800_000_000_000;
const SESSION = "0b0e6d1e-6c2f-4d53-9d38-5a1a2f0c9e11";

function submission(overrides: Partial<LeadSubmission> = {}): LeadSubmission {
  return {
    email: "Jana.Novakova@Example.COM ",
    marketingConsent: false,
    honeypot: "",
    startedAt: String(NOW - 10_000),
    variant: "fees",
    sessionId: SESSION,
    path: "/poplatky",
    utm: { source: "meta", campaign: "fees-v1" },
    ...overrides,
  };
}

/** The lead upsert among the recorded calls (a rate-limit query runs first). */
function upsert(sql: ReturnType<typeof vi.fn<SqlExecutor>>) {
  const calls = sql.mock.calls.filter(([text]) => text.includes("insert into leads"));
  expect(calls).toHaveLength(1);
  return calls[0];
}

function setup(sqlImpl?: SqlExecutor) {
  const sql = vi.fn<SqlExecutor>(sqlImpl ?? (async () => [{ inserted: true }]));
  const createSql = vi.fn(() => sql);
  const deps: LeadDeps = { env: TEST_ENV, now: () => NOW, createSql };
  return { sql, createSql, deps };
}

describe("email normalisation", () => {
  it.each([
    ["  Jana@Example.com ", "jana@example.com"],
    ["USER+tag@Sub.Domain.CZ", "user+tag@sub.domain.cz"],
  ])("normalises %j to %j", (raw, expected) => {
    expect(emailSchema.parse(raw)).toBe(expected);
  });

  it.each(["", "   ", "plain", "a@b", "a b@example.com", "@example.com", `${"a".repeat(250)}@example.com`])(
    "rejects %j",
    (raw) => {
      expect(emailSchema.safeParse(raw).success).toBe(false);
    },
  );
});

describe("processLeadSubmission", () => {
  it("stores the normalised email and returns a token whose hash was saved", async () => {
    const { sql, deps } = setup();
    const result = await processLeadSubmission(submission(), deps);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [text, params] = upsert(sql);
    expect(params[0]).toBe("jana.novakova@example.com");
    expect(params[1]).toBe(hashGuideToken(result.token));
    // The plaintext token and the email never appear in the SQL text or as a stored value.
    expect(params).not.toContain(result.token);
    expect(text).not.toContain(result.token);
    expect(text).not.toContain("jana.novakova");
  });

  it("stores no consent metadata when the box is not ticked", async () => {
    const { sql, deps } = setup();
    await processLeadSubmission(submission({ marketingConsent: false }), deps);
    const params = upsert(sql)[1];
    expect(params[3]).toBe(false);
    expect(params[4]).toBeNull();
  });

  it("stores the exact consent text version when consent is given", async () => {
    const { sql, deps } = setup();
    await processLeadSubmission(submission({ marketingConsent: true }), deps);
    const params = upsert(sql)[1];
    expect(params[3]).toBe(true);
    expect(params[4]).toBe(MARKETING_CONSENT.version);
  });

  it.each(["on", "true", 1, "yes", null, undefined])(
    "does not treat %j as consent: only an explicit true counts",
    async (value) => {
      const { sql, deps } = setup();
      await processLeadSubmission(submission({ marketingConsent: value }), deps);
      expect(upsert(sql)[1][3]).toBe(false);
    },
  );

  it("succeeds without consent: the guide never depends on it", async () => {
    const { deps } = setup();
    expect((await processLeadSubmission(submission({ marketingConsent: false }), deps)).ok).toBe(true);
  });

  it("gives the same outcome for a new and an already-known address", async () => {
    const fresh = setup(async () => [{ inserted: true }]);
    const repeat = setup(async () => [{ inserted: false }]);
    const first = await processLeadSubmission(submission(), fresh.deps);
    const second = await processLeadSubmission(submission(), repeat.deps);
    expect(Object.keys(first)).toEqual(Object.keys(second));
    expect(first.ok && second.ok).toBe(true);
  });

  it("passes the privacy notice version and both configured lead retention periods", async () => {
    const { sql, deps } = setup();
    await processLeadSubmission(submission(), {
      ...deps,
      env: { ...TEST_ENV, LEAD_RETENTION_DAYS: "45", CONSENTED_LEAD_RETENTION_DAYS: "200" },
    });
    const params = upsert(sql)[1];
    expect(params[5]).toBe("test-1");
    expect(params[13]).toBe(45);
    expect(params[16]).toBe(200);
  });

  it("keeps valid acquisition context and replaces anything unsafe", async () => {
    const { sql, deps } = setup();
    await processLeadSubmission(
      submission({
        variant: "hacked",
        sessionId: "not-a-uuid",
        path: "/dekujeme?t=secret",
        utm: { source: "meta", campaign: "me@example.com", term: "a b" },
      }),
      deps,
    );
    const params = upsert(sql)[1];
    expect(params[6]).toBe("compare");
    expect(params[7]).toMatch(/^[0-9a-f-]{36}$/);
    expect(params[7]).not.toBe("not-a-uuid");
    expect(params[8]).toBe("meta");
    expect(params[10]).toBeNull();
    expect(params[12]).toBeNull();
    expect(params[15]).toBe("/");
  });

  it.each([
    ["missing", "", "email_missing"],
    ["blank", "   ", "email_missing"],
    ["not a string", null, "email_missing"],
    ["invalid", "not-an-email", "email_invalid"],
    ["too long", `${"a".repeat(250)}@example.com`, "email_invalid"],
  ])("rejects a %s email without touching the database", async (_name, email, error) => {
    const { createSql, deps } = setup();
    expect(await processLeadSubmission(submission({ email }), deps)).toEqual({ ok: false, error });
    expect(createSql).not.toHaveBeenCalled();
  });

  it("rejects a filled honeypot", async () => {
    const { createSql, deps } = setup();
    const result = await processLeadSubmission(submission({ honeypot: "Acme s.r.o." }), deps);
    expect(result).toEqual({ ok: false, error: "rejected" });
    expect(createSql).not.toHaveBeenCalled();
  });

  it.each([
    ["too fast", String(NOW - (MIN_FILL_MS - 1))],
    ["missing", null],
    ["not a number", "abc"],
    ["in the future", String(NOW + 60_000)],
  ])("rejects a submission whose timing is %s", async (_name, startedAt) => {
    const { createSql, deps } = setup();
    const result = await processLeadSubmission(submission({ startedAt }), deps);
    expect(result).toEqual({ ok: false, error: "rejected" });
    expect(createSql).not.toHaveBeenCalled();
  });

  it.each(Object.keys(TEST_ENV))(
    "refuses to store anything when %s is not configured",
    async (name) => {
      const { createSql, deps } = setup();
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      const result = await processLeadSubmission(submission(), {
        ...deps,
        env: { ...TEST_ENV, [name]: undefined },
      });
      expect(result).toEqual({ ok: false, error: "unavailable" });
      expect(createSql).not.toHaveBeenCalled();
      expect(JSON.stringify(log.mock.calls)).not.toContain("jana");
      log.mockRestore();
    },
  );

  it("checks the lead rate limit before saving and refuses when it is exceeded", async () => {
    const { sql, deps } = setup(async (text) =>
      text.includes("rate_limits") ? [{ client_key: "*", hits: 1000, seconds_left: 30 }] : [],
    );
    const result = await processLeadSubmission(submission(), deps);
    expect(result).toEqual({ ok: false, error: "rate_limited" });
    expect(sql.mock.calls.some(([text]) => text.includes("insert into leads"))).toBe(false);
    expect(sql.mock.calls[0][1]).toEqual(["lead", ["*"], 600]);
  });

  it("passes the per-client key to the limiter without the raw IP", async () => {
    const { sql, deps } = setup();
    await processLeadSubmission(submission(), { ...deps, clientKey: "a".repeat(32) });
    expect(sql.mock.calls[0][1]).toEqual(["lead", ["*", "a".repeat(32)], 600]);
  });

  it("allows a retry after a transient database failure", async () => {
    let attempts = 0;
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { deps } = setup(async (text) => {
      if (text.includes("insert into leads") && attempts++ === 0) throw new Error("timeout");
      return [{ inserted: true }];
    });
    expect((await processLeadSubmission(submission(), deps)).ok).toBe(false);
    expect((await processLeadSubmission(submission(), deps)).ok).toBe(true);
    log.mockRestore();
  });

  it("returns a generic error and no token when the database write fails", async () => {
    const failure = Object.assign(
      new Error('duplicate key value: Key (lower(email))=(jana.novakova@example.com) already exists'),
      { code: "23505" },
    );
    const { deps } = setup(async () => {
      throw failure;
    });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await processLeadSubmission(submission(), deps);

    expect(result).toEqual({ ok: false, error: "server" });
    const logged = JSON.stringify(log.mock.calls);
    expect(logged).toContain("23505");
    expect(logged).not.toContain("jana.novakova");
    expect(logged).not.toContain("duplicate key");
    expect(logged).not.toContain("password");
    log.mockRestore();
  });
});
