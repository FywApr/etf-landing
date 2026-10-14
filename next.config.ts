import type { NextConfig } from "next";

// Applied to every response. The CSP sets only directives that cannot break
// Next.js scripts or styles; a full script-src policy would need nonces.
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  },
  // Browsers ignore HSTS on plain-HTTP localhost, so it is safe to always send.
  { key: "Strict-Transport-Security", value: "max-age=63072000" },
];

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // The PDF guide reads its fonts from disk at request time.
  outputFileTracingIncludes: {
    "/api/guide": ["./assets/fonts/*.ttf"],
  },
  logging: {
    // The dev server prints every request URL. Tokens are no longer put in
    // URLs, but an old bookmarked /dekujeme?t=... link would still carry one.
    incomingRequests: { ignore: [/^\/dekujeme/, /^\/api\/guide/] },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
      {
        // Must come after the rule above: for the same header key the later rule wins,
        // and this response would otherwise get the global Referrer-Policy.
        source: "/api/guide",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
      {
        // Personal access page: keep it out of referrers and indexes.
        source: "/dekujeme",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
