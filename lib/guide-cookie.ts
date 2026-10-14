// The guide access token travels in an HttpOnly cookie, never in a URL.
//
// It is set by the lead form's server action and read by /dekujeme and
// /api/guide. SameSite=Strict keeps it off cross-site requests; HttpOnly keeps
// it away from page scripts. In production it is Secure and uses the __Host-
// prefix, which also pins it to this host and path "/".

import { GUIDE_TOKEN_TTL_DAYS } from "@/lib/guide-token";

type Env = Record<string, string | undefined>;

function isProduction(env: Env): boolean {
  return env.NODE_ENV === "production";
}

/** Browsers reject __Host- cookies without Secure, so the prefix is production-only. */
export function guideCookieName(env: Env = process.env): string {
  return isProduction(env) ? "__Host-guide_access" : "guide_access";
}

export function guideCookieOptions(env: Env = process.env) {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: isProduction(env),
    path: "/",
    maxAge: GUIDE_TOKEN_TTL_DAYS * 24 * 60 * 60,
  };
}
