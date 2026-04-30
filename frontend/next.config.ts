import type { NextConfig } from "next";
import { readFileSync } from "fs";
import { resolve } from "path";

const { version } = JSON.parse(
  readFileSync(resolve(__dirname, "package.json"), "utf-8")
) as { version: string };

/**
 * Security headers applied to every route via next.config headers().
 *
 * Content-Security-Policy is intentionally absent here — it is generated
 * dynamically in `src/middleware.ts` so that:
 *   • A per-request nonce can be embedded in `script-src` (`'nonce-…'`
 *     + `'strict-dynamic'`), which is the pattern recommended by the
 *     Next.js docs.
 *   • `connect-src` is derived from `NEXT_PUBLIC_API_URL` at runtime, so
 *     the CSP works in any deployment environment without hardcoding a URL.
 */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prestyj/pixel"],
  output: "standalone",
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
  },
  async headers() {
    // Turbopack is the default bundler in Next.js 16; no special flags needed.
    // Development CSP (including 'unsafe-eval' for React's error stack
    // reconstruction) is handled in src/middleware.ts, which toggles the
    // directive based on NODE_ENV automatically.
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
