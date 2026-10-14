// Guide access tokens: random, shown to the visitor once, stored only as a hash.

import { createHash, randomBytes } from "node:crypto";

export const GUIDE_TOKEN_TTL_DAYS = 7;

const TOKEN_BYTES = 32;
// 32 random bytes in base64url are exactly 43 characters, without padding.
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export interface GuideToken {
  /** Given to the visitor in the thank-you URL. Never stored or logged. */
  token: string;
  /** SHA-256 hex digest. This is what the database holds. */
  hash: string;
}

/**
 * A plain SHA-256 is sufficient here: the input is 256 bits of randomness, so
 * it cannot be guessed or brute-forced the way a password hash could.
 */
export function hashGuideToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function generateGuideToken(): GuideToken {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  return { token, hash: hashGuideToken(token) };
}

/** Cheap shape check so malformed input never reaches the database. */
export function isWellFormedGuideToken(value: unknown): value is string {
  return typeof value === "string" && TOKEN_PATTERN.test(value);
}

export function guideTokenExpiry(now: Date): Date {
  return new Date(now.getTime() + GUIDE_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
}
