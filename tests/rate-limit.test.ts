// Rate limiter against in-process Postgres (PGlite) with the real schema.

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { SqlExecutor } from "@/lib/db";
import {
  RATE_LIMIT_RULES,
  checkRateLimit,
  clientKeyFromHeaders,
  perClientLimitingConfigured,
} from "@/lib/rate-limit";
import { createTestDatabase, type TestDatabase } from "./helpers/database";

const SECRET = "s".repeat(40);
const VERCEL_ENV = { VERCEL: "1", RATE_LIMIT_SECRET: SECRET };
const CLIENT_A = "a".repeat(32);
const CLIENT_B = "b".repeat(32);
const never = () => 1;

let db: TestDatabase;
beforeAll(async () => {
  db = await createTestDatabase();
});
afterAll(async () => {
  await db.close();
});
beforeEach(async () => {
  await db.exec("delete from rate_limits");
});

async function hit(bucket: keyof typeof RATE_LIMIT_RULES, clientKey: string | null, times: number) {
  const decisions = [];
  for (let index = 0; index < times; index += 1) {
    decisions.push(await checkRateLimit(db.sql, bucket, clientKey, never));
  }
  return decisions;
}

describe("per-client limits", () => {
  it("allows exactly the configured number of lead submissions, then refuses", async () => {
    const decisions = await hit("lead", CLIENT_A, RATE_LIMIT_RULES.lead.perClient + 1);
    expect(decisions.slice(0, -1).every((decision) => decision.allowed)).toBe(true);
    const last = decisions.at(-1)!;
    expect(last.allowed).toBe(false);
    if (!last.allowed) {
      expect(last.retryAfterSeconds).toBeGreaterThan(0);
      expect(last.retryAfterSeconds).toBeLessThanOrEqual(RATE_LIMIT_RULES.lead.windowSeconds);
    }
  });

  it("counts clients separately", async () => {
    await hit("lead", CLIENT_A, RATE_LIMIT_RULES.lead.perClient + 1);
    expect((await checkRateLimit(db.sql, "lead", CLIENT_B, never)).allowed).toBe(true);
  });

  it("counts buckets separately", async () => {
    await hit("lead", CLIENT_A, RATE_LIMIT_RULES.lead.perClient + 1);
    expect((await checkRateLimit(db.sql, "guide", CLIENT_A, never)).allowed).toBe(true);
  });

  it("resets when a new window starts", async () => {
    await hit("lead", CLIENT_A, RATE_LIMIT_RULES.lead.perClient + 1);
    // Move the existing counters into the previous window.
    await db.exec("update rate_limits set window_start = window_start - interval '1 hour'");
    expect((await checkRateLimit(db.sql, "lead", CLIENT_A, never)).allowed).toBe(true);
  });

  it("leaves room for legitimate retries after a failure", () => {
    expect(RATE_LIMIT_RULES.lead.perClient).toBeGreaterThanOrEqual(3);
    expect(RATE_LIMIT_RULES.guide.perClient).toBeGreaterThanOrEqual(5);
  });
});

describe("global limits", () => {
  it("apply even without a client key", async () => {
    await db.sql(
      `insert into rate_limits (bucket, client_key, window_start, hits)
       values ('events', '*', to_timestamp(floor(extract(epoch from now()) / 60) * 60), $1)`,
      [RATE_LIMIT_RULES.events.global],
    );
    const decision = await checkRateLimit(db.sql, "events", null, never);
    expect(decision.allowed).toBe(false);
  });

  it("apply on top of per-client limits", async () => {
    await db.sql(
      `insert into rate_limits (bucket, client_key, window_start, hits)
       values ('lead', '*', to_timestamp(floor(extract(epoch from now()) / 600) * 600), $1)`,
      [RATE_LIMIT_RULES.lead.global],
    );
    expect((await checkRateLimit(db.sql, "lead", CLIENT_B, never)).allowed).toBe(false);
  });
});

describe("storage", () => {
  it("never stores an IP address, only the global marker or a 32-hex key", async () => {
    const key = clientKeyFromHeaders(new Headers({ "x-forwarded-for": "203.0.113.7" }), VERCEL_ENV)!;
    await checkRateLimit(db.sql, "lead", key, never);
    const rows = await db.sql("select client_key from rate_limits", []);
    const keys = rows.map((row) => String(row.client_key)).sort();
    expect(keys).toEqual(["*", key].sort());
    expect(JSON.stringify(rows)).not.toContain("203.0.113.7");
  });

  it("refuses anything that is not a valid client key at the database level", async () => {
    await expect(
      db.sql(
        "insert into rate_limits (bucket, client_key, window_start) values ('lead', '203.0.113.7', now())",
        [],
      ),
    ).rejects.toThrow();
  });

  it("occasionally purges counters older than 24 hours, and only those", async () => {
    await db.exec(`
      insert into rate_limits (bucket, client_key, window_start, hits) values
        ('lead', '*', now() - interval '25 hours', 3),
        ('guide', '*', now() - interval '23 hours', 3);
    `);
    await checkRateLimit(db.sql, "events", null, () => 0);
    const remaining = await db.sql("select bucket from rate_limits order by bucket", []);
    expect(remaining.map((row) => row.bucket)).toEqual(["events", "guide"]);
  });
});

describe("failure handling", () => {
  it("allows the request and logs only the error class when the database fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const failing = vi.fn<SqlExecutor>(async () => {
      throw Object.assign(new Error('relation "rate_limits" does not exist at 203.0.113.7'), {
        code: "42P01",
      });
    });

    expect(await checkRateLimit(failing, "guide", CLIENT_A)).toEqual({ allowed: true });
    const logged = JSON.stringify(log.mock.calls);
    expect(logged).toContain("42P01");
    expect(logged).not.toContain("203.0.113.7");
    expect(logged).not.toContain(CLIENT_A);
    log.mockRestore();
  });
});

describe("client key derivation", () => {
  const headers = (value?: string) =>
    new Headers(value === undefined ? {} : { "x-forwarded-for": value });

  it("produces a stable keyed hash on Vercel", () => {
    const first = clientKeyFromHeaders(headers("203.0.113.7"), VERCEL_ENV);
    expect(first).toMatch(/^[0-9a-f]{32}$/);
    expect(clientKeyFromHeaders(headers("203.0.113.7"), VERCEL_ENV)).toBe(first);
    expect(clientKeyFromHeaders(headers("203.0.113.8"), VERCEL_ENV)).not.toBe(first);
  });

  it("depends on the secret, so it cannot be reproduced by hashing IPs alone", () => {
    const other = { ...VERCEL_ENV, RATE_LIMIT_SECRET: "t".repeat(40) };
    expect(clientKeyFromHeaders(headers("203.0.113.7"), other)).not.toBe(
      clientKeyFromHeaders(headers("203.0.113.7"), VERCEL_ENV),
    );
  });

  it("does not trust forwarding headers outside Vercel, where clients can forge them", () => {
    expect(clientKeyFromHeaders(headers("203.0.113.7"), { RATE_LIMIT_SECRET: SECRET })).toBeNull();
    expect(
      clientKeyFromHeaders(headers("203.0.113.7"), { VERCEL: "0", RATE_LIMIT_SECRET: SECRET }),
    ).toBeNull();
  });

  it("needs a long enough secret", () => {
    expect(clientKeyFromHeaders(headers("203.0.113.7"), { VERCEL: "1" })).toBeNull();
    expect(clientKeyFromHeaders(headers("203.0.113.7"), { VERCEL: "1", RATE_LIMIT_SECRET: "short" })).toBeNull();
    expect(perClientLimitingConfigured({ RATE_LIMIT_SECRET: "short" })).toBe(false);
    expect(perClientLimitingConfigured({ RATE_LIMIT_SECRET: SECRET })).toBe(true);
  });

  it.each([undefined, "", "not-an-ip", "unknown", "203.0.113.7; drop table"])(
    "ignores an unusable header value %j",
    (value) => {
      expect(clientKeyFromHeaders(headers(value), VERCEL_ENV)).toBeNull();
    },
  );

  it("uses the first address of a list and accepts IPv6", () => {
    expect(clientKeyFromHeaders(headers("203.0.113.7, 10.0.0.1"), VERCEL_ENV)).toBe(
      clientKeyFromHeaders(headers("203.0.113.7"), VERCEL_ENV),
    );
    expect(clientKeyFromHeaders(headers("2001:db8::1"), VERCEL_ENV)).toMatch(/^[0-9a-f]{32}$/);
  });
});
