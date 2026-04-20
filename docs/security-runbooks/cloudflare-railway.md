# Cloudflare in front of Railway — Runbook

> Phase 3.7 of `docs/security-plan.md`. Free tier only (security-plan §2.2 forbids paid services until trigger). Mitigates the L7 / bot / WAF gap that Railway alone does not fill.

## Sources

- Cloudflare Authenticated Origin Pulls — `github.com/cloudflare/cloudflare-docs/blob/production/src/content/docs/ssl/origin-configuration/authenticated-origin-pull/aws-alb-integration.mdx` (the canonical reference for mTLS between CF and origin; Railway custom-CA support TBC, see §3).
- Turnstile integration — `github.com/SonicJs-Org/sonicjs/blob/main/packages/core/src/plugins/core-plugins/turnstile-plugin/middleware/verify.ts` and `github.com/nhost/nhost/blob/main/services/auth/go/middleware/turnstile.go` (frontend `cf-turnstile-response` token + backend `siteverify` POST).
- Cloudflare-friendly proxy guidance — `github.com/axel-denis/control/blob/main/docs/perModule/routing.md` (default Cloudflare AOP CA usage when proxy is enabled — illustrates the "free path" we're taking).

---

## 1. Why Cloudflare in front of Railway

Railway terminates valid Let's Encrypt certs and provides L4 routing — that's it. We add Cloudflare's free tier to fill these gaps:

| Capability | Without Cloudflare | With Cloudflare free |
|---|---|---|
| L7 DDoS absorption | None | Always-on, included |
| Basic WAF (managed rules: OWASP CRS, CF managed) | None | "Free" managed ruleset (limited) + 5 custom rules |
| Bot challenge | None | Bot Fight Mode (free, coarse) — challenges suspicious requests |
| CAPTCHA on auth surfaces | None | Turnstile widget (free) — privacy-preserving alternative to hCaptcha/reCAPTCHA |
| Static-asset CDN | Railway egress only | Cached at the edge, "Always Online" mode |
| TLS reinforcement | LE certs | HSTS at edge + minimum TLS version enforcement + cipher pinning |
| Origin secrecy | Origin DNS publicly known | Proxied: only CF IPs talk to Railway |
| Authenticated Origin Pulls | shared-secret header | True mTLS unsupported on Railway; compensating control via `CloudflareOriginAuthMiddleware` (see §3) |

Limits we explicitly accept:
- **5 custom WAF rules / zone** on free tier.
- **10K rule-engine requests / month** for advanced rate-limiting (free quota).
- **No mTLS upload to Railway** confirmed at time of writing — see §3 caveat.
- **No log delivery** on free tier — incident-response (`incident-response.md` §6) cannot rely on CF logs as primary evidence.

## 2. DNS migration plan

Pre-migration:
- [ ] Sign up for Cloudflare, add the `anchormillgroup.com` zone, complete email verification.
- [ ] Note current authoritative nameservers (record them in the rollback plan §11).
- [ ] Lower TTL on the apex + every record to 300 s at the existing registrar **48 h before** cutover.

Cutover:
1. **Import existing DNS** records into Cloudflare (auto-scan; verify every A/CNAME/MX/TXT/CAA against current zone before publishing).
2. **Switch to "DNS only" (grey-cloud)** initially for every record. This proves resolution works without enabling the proxy.
3. **Update registrar nameservers** to Cloudflare's. Wait for global propagation (24–48 h).
4. **Per-host, flip to "Proxied" (orange-cloud)** one at a time, in this order:
   - `app.anchormillgroup.com` (frontend) — easiest; static + Next.js SSR.
   - `api.anchormillgroup.com` (backend) — verify CSP + cookie behaviour end-to-end before flipping.
   - WSS / WebSocket subdomain — confirm CF proxies WebSockets correctly (it does, on free tier; verify in staging first).
5. **Smoke-test from a clean session** after each flip: login, MFA, file upload, file download (proxy-through path), WebSocket session, partner-portal flow.

Required record shape after cutover:

| Name | Type | Value | Proxy |
|---|---|---|---|
| `app` | CNAME | `<railway-frontend>.up.railway.app` | Proxied |
| `api` | CNAME | `<railway-backend>.up.railway.app` | Proxied |
| `_acme-challenge.app` | CNAME | per Railway docs | DNS only |
| `_acme-challenge.api` | CNAME | per Railway docs | DNS only |
| MX, SPF, DKIM, DMARC | as-is | n/a | DNS only |

## 3. SSL/TLS configuration

- **Mode:** Full (strict). Railway's Let's Encrypt cert is valid; CF will validate it on every connection. **Do not** use "Flexible" (terminates TLS at CF, plaintext to origin — security regression).
- **Edge certificates:** Universal SSL on (default).
- **Minimum TLS version:** **TLS 1.3** at the edge. Browsers without TLS 1.3 will fail; acceptable for AMG's UHNW client base in 2026.
- **HSTS at edge:** enable with `max-age=31536000; includeSubDomains; preload`. Reinforces the backend HSTS header (security-plan §7.4).
- **Authenticated Origin Pulls (AOP) — NOT AVAILABLE on Railway.** Verified against `docs.railway.com/guides/public-networking` (2026-04-20): Railway terminates TLS with auto-provisioned LE certs and exposes no custom-CA upload path. Open Railway support tickets going back two years confirm this. **Compensating control implemented:** shared-secret header injected by a Cloudflare Transform Rule and validated server-side by `backend/app/middleware/cloudflare_origin.py`.
  - Configure on backend Railway service:
    - `CF_ORIGIN_AUTH_HEADER=X-CF-Origin-Auth`
    - `CF_ORIGIN_AUTH_TOKEN=<32-byte random secret, e.g. openssl rand -hex 32>`
  - In the Cloudflare dashboard for the proxied hostname, **Rules → Transform Rules → Modify Request Header → Set static**: header `X-CF-Origin-Auth`, value `<the same secret>`.
  - When both env vars are set, the middleware returns `404` for any request whose header is missing or wrong, so direct hits to the Railway origin URL are rejected without leaking that the host exists.
  - `/health`, `/api/v1/security/csp-report`, and `/api/v1/security/reports` bypass the check (Railway internal health probes can't carry the header; browsers can't add it to CSP reports).
  - Rotation: generate a new token, push to Railway env first (the middleware accepts only the new token after restart), then update the Cloudflare Transform Rule. Keep the deploy window narrow (≤30s).
  - Reference (when true mTLS becomes possible): `github.com/cloudflare/cloudflare-docs/blob/production/src/content/docs/ssl/origin-configuration/authenticated-origin-pull/aws-alb-integration.mdx`.

## 4. Bot Fight Mode + Turnstile

### 4.1 Bot Fight Mode

- Security → Bots → enable **Bot Fight Mode**.
- Choose "Definitely automated" → Block; "Likely automated" → Managed Challenge.
- Tune over the first week: review the Bots dashboard daily; whitelist known good UAs (uptime monitors, Make.com / Zapier callbacks if any) via a custom WAF rule (§5).

### 4.2 Turnstile on auth surfaces

Three pages MUST require Turnstile: `/login`, `/register`, `/forgot-password`. Optional on `/api/v1/auth/refresh` if abuse is observed.

**Frontend integration shape** (`frontend/src/app/(auth)/login/page.tsx` and similar):

```tsx
import Script from "next/script";

// In the page component, add the Turnstile script (it self-renders into a div):
<Script
  src="https://challenges.cloudflare.com/turnstile/v0/api.js"
  async
  defer
  // SRI per docs/security-runbooks/sri-policy.md — pin a hash to a versioned URL
  // when CF publishes one; see follow-up in the SRI policy.
  nonce={nonce}
/>
<div
  className="cf-turnstile"
  data-sitekey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
  data-callback="onTurnstileSuccess"
/>
```

The widget injects a hidden input named `cf-turnstile-response` into the form; submit alongside email/password.

**Backend verification** (`backend/app/api/v1/auth.py` — login + register + forgot-password handlers):

```python
import httpx
TURNSTILE_VERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify"

async def _verify_turnstile(token: str, ip: str) -> bool:
    async with httpx.AsyncClient(timeout=httpx.Timeout(5.0, connect=2.0)) as cx:
        r = await cx.post(TURNSTILE_VERIFY, data={
            "secret": settings.TURNSTILE_SECRET_KEY,
            "response": token,
            "remoteip": ip,
        })
    return r.json().get("success", False) is True
```

Return generic error on failure ("Could not verify request, please retry") — do **not** leak Turnstile-specific error codes to the client (info disclosure).

Env vars:
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` — public sitekey, frontend only.
- `TURNSTILE_SECRET_KEY` — wrapped with KEK (security-plan §5 D2) once Phase 1 lands. Until then: Railway env var with restricted access.

## 5. WAF custom rules

Free tier allows 5 custom rules per zone. Spend them carefully.

### 5.1 Block known-bad UAs

```
(http.user_agent contains "sqlmap") or
(http.user_agent contains "nikto") or
(http.user_agent contains "wpscan") or
(http.user_agent contains "masscan") or
(http.user_agent contains "zgrab")
→ Action: Block
```

### 5.2 Geofence (when US-only is enforced operationally)

Currently scoped per security-plan §2.2 ("US-only operations for now") — this rule is **opt-in**, defaults off. When enabled:

```
(not ip.geoip.country in {"US"})
and (http.request.uri.path contains "/api/v1/")
and (not http.request.uri.path contains "/api/v1/health")
→ Action: Managed Challenge
```

Use Managed Challenge, not Block — clients travel; UHNW clients especially. A blanket Block would generate support tickets within a week.

### 5.3 Rate-limit `/api/v1/auth/*`

Free tier rate-limiting is coarse: 10K rule-engine requests / month, simple thresholds. Acceptable for auth surfaces because legitimate auth volume is low.

```
(http.request.uri.path contains "/api/v1/auth/")
and (http.request.method in {"POST"})
→ Rate limit: 10 requests per 1 minute per IP
   Action: Managed Challenge → Block on continued abuse
```

Backend Redis-backed rate limiter (already in stack) remains the primary control; CF rule is defence-in-depth and absorbs the load before it reaches Railway.

### 5.4 Restrict `api.` to Cloudflare IPs only (origin firewall)

Railway does **not** expose origin-IP firewalling on its managed routing layer (verified empty in docs 2026-04-20). The shared-secret AOP compensating control (§3) replaces this — a request that doesn't transit Cloudflare can't get the right `X-CF-Origin-Auth` value, so origin-IP filtering becomes redundant.

If, in the future, Railway adds origin-IP allow-listing, layer it on top of the shared-secret check (defence-in-depth — neither alone is ideal). In the interim the layered controls are:
- `CloudflareOriginAuthMiddleware` rejects with 404 on missing/wrong header (§3).
- Railway-assigned origin URLs are random + non-discoverable.
- CF rule below blocks any request that doesn't carry a CF-managed header (sanity check, easy to spoof — value is forensic, not preventive):

```
(not http.request.headers["cf-ray"][0] matches "^[0-9a-f]+-[A-Z]{3}$")
and (http.request.uri.path contains "/api/v1/")
→ Action: Log (do not block — false-positive risk on internal calls)
```

### 5.5 Block CSRF probes on cross-origin POSTs missing the token header

```
(http.request.method in {"POST", "PUT", "PATCH", "DELETE"})
and (http.request.uri.path contains "/api/v1/")
and (not http.request.headers["x-csrf-token"][0] matches "^[A-Za-z0-9_-]{32,}$")
and (http.referer ne "")
and (not http.referer contains "anchormillgroup.com")
→ Action: Block
```

Defence in depth on top of the CSRF middleware (security-plan §0.1).

## 6. Page rules (cache behaviour)

Free tier allows 3 page rules. Allocate as:

1. **`api.anchormillgroup.com/*` → Cache Level: Bypass.** Backend responses must never be cached at the edge; they're per-user and contain auth-sensitive payloads.
2. **`app.anchormillgroup.com/_next/static/*` → Cache Level: Cache Everything; Edge Cache TTL: 1 month.** Next.js static asset hashes are content-addressed; safe to cache aggressively.
3. **`app.anchormillgroup.com/*` → Cache Level: Standard; Origin Cache Control: On.** Honour Next.js's per-route `Cache-Control` headers (especially `no-store` on authed pages).

If Cloudflare ever upgrades free-tier page rules to 5 or more, add:
- `app.anchormillgroup.com/.well-known/audit-key.pem → Cache Everything; Edge Cache TTL: 1 day` (public verification key; cacheable).

## 7. Origin port + protocol

- Railway listens on the public-facing HTTPS port that Cloudflare resolves through the CNAME. No origin port override needed.
- WebSocket subdomain (if separate): same CNAME pattern. Confirm "WebSockets" is **on** under Network settings (it is by default on free tier).

## 8. Logging & monitoring

- **No log delivery on free tier** — Cloudflare Firewall Events / Bot Score / Page Rule Events are visible only in the dashboard.
- For incident-response evidence, **Railway logs remain primary** (`incident-response.md` §6). Cloudflare dashboard data is corroborating, not authoritative.
- Configure Cloudflare's email notifications for: SSL cert issues, traffic anomalies, WAF rule trigger spikes. Send to the on-call alias.

## 9. Caveats (read before any change)

1. **Free tier rate-limit budget is 10K rule-engine requests / month.** A traffic spike against `/api/v1/auth/*` can burn this in hours and silently disable the rate-limit rule for the rest of the month. Backend rate limiter must remain the floor.
2. **Free tier WAF custom rules cap is 5.** Section 5 already proposes 5 rules; any new rule requires retiring an old one or upgrading.
3. **Bot Fight Mode false-positives** legitimate UHNW clients on uncommon browsers. Tune for the first 14 days; keep a "skip Bot Fight Mode" rule in pocket for clients whose IPs we know.
4. **Turnstile depends on `challenges.cloudflare.com` reachability.** Air-gapped or hostile-network clients may not load it. Provide a fallback: TOTP + email-OTP path (already in product).
5. **CSP must allow `https://challenges.cloudflare.com` in `script-src` and `frame-src`.** Update `frontend/src/middleware.ts` when Turnstile is enabled. The current CSP does **not** allow it — expect breakage on first load if you forget.
6. **Authenticated Origin Pulls** — true mTLS not available on Railway; compensating shared-secret middleware shipped (see §3).
7. **Origin IP is still discoverable** via DNS history sites (CRTSH, securitytrails) until the migration ages out (~30 days). Until then, bypass attacks on the Railway URL directly remain possible.

## 10. Validation checklist (run after migration)

- [ ] `dig app.anchormillgroup.com` returns Cloudflare IP (104.x or similar).
- [ ] `curl -I https://app.anchormillgroup.com` shows `cf-ray:` header in response.
- [ ] HSTS header present and matches edge config.
- [ ] WSS connections succeed end-to-end.
- [ ] Login → MFA → dashboard works (Turnstile on / off both tested).
- [ ] File upload → ClamAV scan → MinIO put → audit row works (proxy-through path; check Cloudflare doesn't buffer >100 MB uploads — free tier hard limit, see Cloudflare docs).
- [ ] CSP report endpoint receives violations as expected (when CSP-report endpoint is added; currently a follow-up — see security-plan §3.10).
- [ ] WAF custom rules visible and active in dashboard.
- [ ] Page rules listed + matching expected hosts.

## 11. Rollback procedure

If a Cloudflare-induced regression occurs and immediate rollback is needed:

1. **At the registrar:** revert nameservers to the pre-Cloudflare authoritative nameservers (recorded in §2 pre-migration). Wait for propagation; legitimate users connect direct to Railway again.
2. **At Railway:** if the CNAME-based custom domain is still configured, traffic resumes at the Railway-issued cert. If the custom domain was removed during migration, re-add it via `railway domain` and wait for LE issuance.
3. **At Cloudflare:** "Pause Cloudflare on Site" toggle (Overview page) bypasses all CF logic instantly without changing DNS — useful for a 5-minute "is it CF or origin?" diagnostic during an incident, before deciding on full nameserver rollback.
4. **Communicate:** the incident-response runbook (`incident-response.md` §8) governs client comms during any visible outage.

After rollback, file a GitHub Issue with label `cloudflare-rollback`, root-cause the regression, and remediate before re-attempting.

---

**Last reviewed:** 2026-04-20
**Owner:** Tech Lead
