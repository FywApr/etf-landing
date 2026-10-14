import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // The PDF guide reads its fonts from disk at request time.
  outputFileTracingIncludes: {
    "/api/guide": ["./assets/fonts/*.ttf"],
  },
  logging: {
    // The dev server prints every request URL; these two carry guide tokens.
    incomingRequests: { ignore: [/^\/dekujeme/, /^\/api\/guide/] },
  },
  async headers() {
    return [
      {
        // The thank-you URL carries the guide token: keep it out of referrers and indexes.
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
