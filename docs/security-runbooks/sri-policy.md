# Subresource Integrity (SRI) Policy

> Phase 3.10 of `docs/security-plan.md`. Mitigates Blindspot §9.6 (third-party JS rug-pull on authenticated pages).

## Sources

- htmx SRI script — `github.com/bigskysoftware/htmx/blob/master/scripts/sha.sh` (canonical `openssl dgst -sha384 -binary | openssl base64 -A` for hash generation).
- Sentry SDK SRI generator — `github.com/getsentry/sentry-dart/blob/main/packages/flutter/scripts/update-js.sh` (real-world workflow for fetching + pinning a third-party SDK's SRI hash, including BotFramework-WebChat's `loadAsset.js` pattern at `github.com/microsoft/BotFramework-WebChat/blob/main/packages/embed/src/setups/loadAsset.js`).
- Cypress SRI test fixtures — `github.com/cypress-io/cypress/blob/develop/packages/driver/cypress/e2e/e2e/origin/integrity.cy.ts` (SHA-256 / SHA-384 / SHA-512 are all valid; SHA-384 is the recommended algorithm; matches MDN guidance).

---

## 1. Policy

> **Any third-party JavaScript or CSS loaded into authenticated pages of the AMG frontend MUST use Subresource Integrity (SRI) — `integrity="sha384-..."` paired with `crossorigin="anonymous"` — and MUST be pinned to a specific version.**

Mandatory:

1. **Self-host fonts.** Google Fonts, Adobe Fonts, etc. — load via `next/font` (already done in `frontend/src/app/layout.tsx` via `Plus_Jakarta_Sans`, `IBM_Plex_Mono`, `Playfair_Display`). Never `<link rel="stylesheet" href="https://fonts.googleapis.com/...">` directly.
2. **Self-host icons.** No `cdn.jsdelivr.net/npm/lucide`-style direct imports — `lucide-react` is bundled.
3. **Analytics widgets:** **forbidden** on any route under `frontend/src/app/(dashboard)/`, `frontend/src/app/(partner)/`, `frontend/src/app/(portal)/`, or any route protected by middleware-level auth gating. If analytics are added on the marketing surface only, they go through Next.js `<Script src=... integrity=... crossorigin="anonymous" nonce={nonce} />` with a pinned hash.
4. **Authentication / CAPTCHA widgets** (Cloudflare Turnstile, hCaptcha, Sentry SDK loader, etc.): pin the published SRI hash and the version string. If the vendor does not publish an SRI hash, generate it locally (§4) and re-pin on every vendor version bump.
5. **Currently allowed third-party origins on authenticated pages:** **none**. Confirmed by `scripts/check-sri.sh` against `frontend/src/app/` and `frontend/src/components/` (output empty as of 2026-04-20).

## 2. Failure mode

If the browser's SRI check fails (vendor changed bytes without changing version, MITM, CDN compromise, etc.):

- The browser **must not** load the script. **Do not** implement an automatic fallback to a hash-less load — that defeats the entire control.
- The page reports the violation via `/api/v1/security/csp-report` (CSP Level 2) and `/api/v1/security/reports` (Reporting-API). Both endpoints are wired into `frontend/src/middleware.ts` via `report-uri` + `report-to` and surface as `event=csp.violation` in Railway logs.
- The frontend gracefully degrades: feature using the broken script is disabled and the user is shown a generic "Service temporarily unavailable" notice (no leak of vendor identity).
- Operationally: an SRI failure is a **P1** in the incident-response runbook (`incident-response.md` §7.4 — CSP / SRI violation spike treatment applies).

## 3. Currently-allowed third parties

Scanned 2026-04-20 by `scripts/check-sri.sh` plus a manual sweep with `Grep` over `frontend/src/app/**` and `frontend/src/components/**`:

| Origin | Loaded by | SRI hash | Pinned version |
|---|---|---|---|
| (none) | (none) | n/a | n/a |

Fonts are loaded via `next/font/google` — these are **server-fetched at build time** and self-served from the same origin (the browser sees them as `self`), so they are not subject to SRI policy and require no entry above.

When the first third-party script is added (likely Cloudflare Turnstile per `cloudflare-railway.md` §4), this table must be updated in the same PR. The SRI check script (§5) gates the build.

## 4. Generating SRI hashes

For any new third-party asset, generate the hash locally before committing the `<Script>` tag:

```bash
# JavaScript file from a CDN
curl -sSL "https://challenges.cloudflare.com/turnstile/v0/api.js" \
  | openssl dgst -sha384 -binary | openssl base64 -A
# Output: <hash> — prefix with "sha384-" in the integrity attribute.

# Or for a local file
cat path/to/file.js | openssl dgst -sha384 -binary | openssl base64 -A
```

Pin both the URL (must include a version segment — never `latest`) **and** the hash. Example shape (from the Daemonite/material reference):

```tsx
<Script
  src="https://challenges.cloudflare.com/turnstile/v0/api.js"
  integrity="sha384-<hash>"
  crossOrigin="anonymous"
  nonce={nonce}
  strategy="afterInteractive"
/>
```

Note: in JSX `crossOrigin` is camelCase and `crossorigin` would be invalid; the script reflects this distinction.

## 5. Helper script

`scripts/check-sri.sh` greps the frontend for third-party `<Script>` / `<link rel="stylesheet">` / `<script>` tags pointing to `https?://` and fails loudly when `integrity=` is missing.

```bash
# From the repo root:
./scripts/check-sri.sh

# Exit 0 if all third-party loads have SRI; exit 1 with a list of offending
# files:line on any violation.
```

## 6. CI integration

The check is **wired and blocking** as the `sri-check` job in
`.github/workflows/frontend-ci.yml`. It runs on every PR and on every push
to `main`, and a non-zero exit (any third-party JS/CSS without
`integrity=`) fails the build. Today's posture (zero third-party loads)
makes the cost of "blocking from day 1" effectively zero.

To skip the gate temporarily for a justified vendor introduction, add a
`# sri:exempt` comment on the same line as the load — extend
`scripts/check-sri.sh` to honour the marker if/when this is needed.

Match the SHA-pinning style of `frontend-ci.yml` and `security.yml` (security-plan §0.8).

## 7. Vendor version bumps

When any pinned third-party asset bumps version:

1. Generate the new SRI hash locally (§4).
2. Update both the `src=` URL and the `integrity=` attribute in the same commit.
3. Update the table in §3.
4. Verify the change locally — load the affected page and check DevTools → Console for SRI errors.
5. PR description must include the hash command output as evidence.

If a vendor "live-updates" assets without version bumps (Sentry loader, Cloudflare Turnstile), pin to a versioned alias (e.g. `https://js.sentry-cdn.com/<key>/loader-<sha>.min.js`) where available. If only a `latest` URL is offered: do not use it on authenticated pages.

## 8. Outstanding follow-ups

- [x] CSP report endpoint shipped at `/api/v1/security/csp-report` + `/api/v1/security/reports`; `report-uri` and `report-to` wired in `frontend/src/middleware.ts`. CI guard at `.github/workflows/frontend-ci.yml` (`sri-check` job) blocks regressions.
- [ ] When Turnstile is enabled (`cloudflare-railway.md` §4), update §3 with the pinned hash + versioned URL.
- [ ] When a Sentry / error-reporter SDK is adopted, prefer self-hosted via npm import over CDN load; if CDN is unavoidable, follow §4.

---

**Last reviewed:** 2026-04-20
**Owner:** Tech Lead
