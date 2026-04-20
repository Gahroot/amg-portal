import { type NextRequest, NextResponse } from "next/server";

/**
 * Middleware — runs on every matched request to:
 *  1. Generate a per-request cryptographic nonce.
 *  2. Build a Content-Security-Policy header that uses `'nonce-{nonce}'` +
 *     `'strict-dynamic'` for script-src (recommended by Next.js docs).
 *  3. Derive `connect-src` origins from NEXT_PUBLIC_API_URL so the CSP works
 *     in any environment without hardcoding localhost.
 *  4. Forward the nonce to the page via the `x-nonce` request header so that
 *     Server Components can pass it to <Script nonce={nonce}> or inline scripts.
 */
export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";

  // Derive the API origin(s) from the public env var so that production
  // deployments don't need to touch this file.  The WS counterpart is
  // synthesised automatically (http → ws, https → wss).
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  const apiOrigin = (() => {
    try {
      return new URL(apiUrl).origin;
    } catch {
      return apiUrl;
    }
  })();
  // Build the WebSocket equivalent of the API origin (http→ws, https→wss).
  const wsOrigin = apiOrigin.replace(/^http:/, "ws:").replace(/^https:/, "wss:");

  // Nonce-based CSP with 'strict-dynamic'. We intentionally DO NOT include
  // 'unsafe-inline' in script-src — per the CSP3 spec, browsers that support
  // 'strict-dynamic' ignore host/source-list expressions and 'unsafe-inline'
  // anyway, but dropping it makes the intent explicit. In dev we still need
  // 'unsafe-eval' for React Fast Refresh / Next.js HMR.
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""};
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: blob:;
    font-src 'self';
    connect-src 'self' ${apiOrigin} ${wsOrigin};
    object-src 'none';
    frame-ancestors 'none';
    base-uri 'self';
    form-action 'self';
  `
    .replace(/\s{2,}/g, " ")
    .trim();

  // Attach the nonce to request headers so Server Components can read it.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", cspHeader);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // Also set the CSP on the response so the browser enforces it.
  response.headers.set("Content-Security-Policy", cspHeader);

  return response;
}

/**
 * Only run middleware on page/API requests.  Skip static assets and image
 * optimisation files — they don't need a CSP and the nonce would be wasted.
 */
export const config = {
  matcher: [
    {
      source:
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
