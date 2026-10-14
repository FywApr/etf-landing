// Access cookie flags, HTTP security headers and the public events route.

import { describe, expect, it } from "vitest";
import nextConfig from "../next.config";
import { POST as postEvent } from "@/app/api/events/route";
import { guideCookieName, guideCookieOptions } from "@/lib/guide-cookie";
import { GUIDE_TOKEN_TTL_DAYS } from "@/lib/guide-token";

describe("guide access cookie", () => {
  it("is HttpOnly, SameSite=Strict, scoped to the site and limited to the token lifetime", () => {
    const options = guideCookieOptions({ NODE_ENV: "development" });
    expect(options).toMatchObject({ httpOnly: true, sameSite: "strict", path: "/" });
    expect(options.maxAge).toBe(GUIDE_TOKEN_TTL_DAYS * 24 * 60 * 60);
  });

  it("is Secure with the __Host- prefix in production only", () => {
    expect(guideCookieOptions({ NODE_ENV: "production" }).secure).toBe(true);
    expect(guideCookieName({ NODE_ENV: "production" })).toBe("__Host-guide_access");
    expect(guideCookieOptions({ NODE_ENV: "development" }).secure).toBe(false);
    expect(guideCookieName({ NODE_ENV: "development" })).toBe("guide_access");
  });
});

describe("security headers", () => {
  async function headersFor(source: string) {
    const rules = await nextConfig.headers!();
    const rule = rules.find((entry) => entry.source === source);
    expect(rule).toBeDefined();
    return Object.fromEntries(rule!.headers.map(({ key, value }) => [key, value]));
  }

  it("applies baseline protections to every route", async () => {
    const headers = await headersFor("/:path*");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
    expect(headers["Content-Security-Policy"]).toContain("form-action 'self'");
    expect(headers["Content-Security-Policy"]).not.toContain("script-src");
    expect(headers["Permissions-Policy"]).toContain("camera=()");
    expect(headers["Strict-Transport-Security"]).toMatch(/max-age=\d+/);
  });

  it("sends no referrer from the guide download, overriding the global rule", async () => {
    const rules = await nextConfig.headers!();
    const order = rules.map((entry) => entry.source);
    expect(order.indexOf("/api/guide")).toBeGreaterThan(order.indexOf("/:path*"));
    expect((await headersFor("/api/guide"))["Referrer-Policy"]).toBe("no-referrer");
  });

  it("sends no referrer from the thank-you page and keeps it out of indexes", async () => {
    const rules = await nextConfig.headers!();
    const order = rules.map((entry) => entry.source);
    // The later rule wins for the same header key, so the page rule must come last.
    expect(order.indexOf("/dekujeme")).toBeGreaterThan(order.indexOf("/:path*"));
    const headers = await headersFor("/dekujeme");
    expect(headers["Referrer-Policy"]).toBe("no-referrer");
    expect(headers["X-Robots-Tag"]).toBe("noindex, nofollow");
  });
});

describe("events route", () => {
  const validBody = JSON.stringify({
    eventId: "8f0b9a3e-1d2c-4c5b-9a7e-6f1e2d3c4b5a",
    sessionId: "0b0e6d1e-6c2f-4d53-9d38-5a1a2f0c9e11",
    name: "page_view",
    variant: "compare",
    path: "/",
    utm: {},
    properties: {},
  });

  function request(body: string, headers: Record<string, string>) {
    return new Request("http://localhost:3000/api/events", {
      method: "POST",
      body,
      headers: { host: "localhost:3000", "content-type": "application/json", ...headers },
    });
  }

  it("rejects posts from another site", async () => {
    const response = await postEvent(request(validBody, { origin: "https://evil.example" }));
    expect(response.status).toBe(403);
  });

  it("rejects a non-JSON content type", async () => {
    const response = await postEvent(
      request(validBody, { origin: "http://localhost:3000", "content-type": "text/plain" }),
    );
    expect(response.status).toBe(415);
  });

  it("rejects an oversized declared body", async () => {
    const response = await postEvent(request(validBody, { "content-length": "100000" }));
    expect(response.status).toBe(413);
  });

  it("answers with a status only and no-store, never with details", async () => {
    const response = await postEvent(request("{bad json", { origin: "http://localhost:3000" }));
    expect(response.status).toBe(400);
    expect(await response.text()).toBe("");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
