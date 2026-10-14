import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  GUIDE_TOKEN_TTL_DAYS,
  generateGuideToken,
  hashGuideToken,
  isWellFormedGuideToken,
} from "@/lib/guide-token";

describe("guide tokens", () => {
  it("generates 32 random bytes as unpadded base64url", () => {
    const { token } = generateGuideToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(token, "base64url")).toHaveLength(32);
  });

  it("does not repeat", () => {
    const tokens = new Set(Array.from({ length: 200 }, () => generateGuideToken().token));
    expect(tokens.size).toBe(200);
  });

  it("returns the SHA-256 of the token as the value to store", () => {
    const { token, hash } = generateGuideToken();
    expect(hash).toBe(createHash("sha256").update(token).digest("hex"));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashGuideToken(token)).toBe(hash);
  });

  it("never exposes the token inside its hash", () => {
    const { token, hash } = generateGuideToken();
    expect(hash).not.toContain(token);
    expect(hash).not.toBe(token);
  });

  it.each([
    undefined,
    null,
    "",
    "short",
    "a".repeat(42),
    "a".repeat(44),
    `${"a".repeat(42)}=`,
    `${"a".repeat(42)}/`,
    `${"a".repeat(40)} ab`,
    ["a".repeat(43)],
    12345,
  ])("rejects malformed token %j", (value) => {
    expect(isWellFormedGuideToken(value)).toBe(false);
  });

  it("has a limited lifetime", () => {
    expect(GUIDE_TOKEN_TTL_DAYS).toBeGreaterThan(0);
    expect(GUIDE_TOKEN_TTL_DAYS).toBeLessThanOrEqual(30);
  });
});
