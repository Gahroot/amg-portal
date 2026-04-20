# Mobile Cert Pinning + Device Integrity Runbook

Phase 3.6 of `docs/security-plan.md`. Covers operating the SSL-pinning
config and the jailbreak/root soft-gate baked into the AMG Portal mobile
app (`mobile/`).

> Pinning is enforced **at the OS / TLS layer** through the Expo config
> plugin `mobile/plugins/withCertificatePinning.js`:
>
> - **Android** — `app/src/main/res/xml/network_security_config.xml` with
>   `<pin-set>` per host. The system-level TLS handshake rejects unknown
>   SPKIs before any HTTP code runs.
> - **iOS** — `Info.plist` → `NSAppTransportSecurity` →
>   `NSPinnedDomains` → `NSPinnedLeafIdentities`. Same enforcement
>   semantics, courtesy of `URLSession`.
>
> No JS-level cert-pinning library is needed because axios runs on top of
> the platform stack.

---

## 1. Compute SPKI pins

Use `mobile/scripts/compute-spki-pin.sh`. It does the OpenSSL dance
(s_client → x509 -pubkey → pkey -pubin DER → dgst sha256 → base64) for
you.

```bash
./mobile/scripts/compute-spki-pin.sh api.amg-portal.com
# host=api.amg-portal.com
# port=443
# spki_sha256_base64=<43-char base64 SHA-256>
```

You need **two** pins per host:

1. **Primary** — the leaf cert currently served in production.
2. **Backup** — a leaf cert prepared for the next renewal cycle (or the
   intermediate CA, if the issuing CA is stable). The OS validates the
   chain against the union of the pin set, so a single match passes.

Always ship a backup pin; without it, when the cert renews the app
hard-fails until the next release. `semgrep/semgrep-rules` flags
`pin-set` blocks without a backup pin for exactly this reason.

## 2. Update `app.json`

```json
"extra": {
  "certPins": {
    "api.amg-portal.com": {
      "primary": "<base64 SPKI sha256 — current leaf>",
      "backup":  "<base64 SPKI sha256 — next renewal>",
      "expiration": "YYYY-MM-DD"
    }
  }
}
```

`expiration` (Android only) acts as a fail-safe — when the date passes,
Android stops enforcing the pin set rather than bricking the app. Set it
to a date a few months past the longest currently-valid cert.

If the WebSocket origin differs from the REST origin, add a second host
key (e.g. `ws.amg-portal.com`).

## 3. Build & deploy

```bash
cd mobile
npx expo prebuild --clean      # regenerate native projects
eas build --platform all       # production builds
```

The prebuild step writes the XML / Info.plist; the EAS build packages
them.

**Production guard.** When `EAS_BUILD_PROFILE=production` (set
automatically on every EAS production build) the plugin throws and
aborts the build if any pin entry still starts with `REPLACE_WITH_…`,
or if the host's backup pin is missing. This makes shipping a build
with no real pinning a hard error, not a silent regression. Local
`expo run` and `EAS_BUILD_PROFILE=preview` builds skip the guard so
day-to-day work isn't blocked.

To exercise the guard locally:

```bash
EAS_BUILD_PROFILE=production npx expo prebuild --clean
# → "Refusing to build production app with unconfigured certificate pins."
```

## 4. Validate the pin

Validate before promoting an OTA / store release:

1. Spin up `mitmproxy` with its CA installed in the device trust store.
2. Run the app over the proxy.
3. Confirm `axios` requests fail with a TLS error and **never** appear
   in mitmproxy's flow list. If they do, the pin is missing or wrong.

Re-run on every renewal — pinning regressions are silent until the cert
flips.

---

## Rotation playbook (~30 days before cert expiry)

1. **T-30**: Generate / receive the new leaf cert. Compute its SPKI hash.
2. Update `expo.extra.certPins[host].backup` to the new hash, leave
   `primary` pointing at the live cert.
3. Ship a release containing both pins. Wait until adoption is healthy
   (Expo metrics).
4. **Cut-over day**: rotate the cert at the origin. Both pins are
   accepted; the new cert matches `backup`, the old still matches
   `primary` (briefly, until cache flushes).
5. **T+7**: Promote `backup` → `primary`, generate a fresh `backup` for
   the *next* renewal, ship the next release.

If a cert is rotated unexpectedly without a pre-shipped backup, the only
mitigation is an OTA update (Expo OTA, signed) or a forced store
update. Both take hours-to-days; the runbook is to keep the backup pin
current at all times.

---

## Jailbreak / root soft-gate

Covered by `mobile/components/DeviceIntegrityGate.tsx` +
`mobile/lib/device-integrity.ts`, wired into `mobile/app/_layout.tsx`.

- Uses [`jail-monkey`](https://github.com/GantMan/jail-monkey) for the
  per-platform checks (`isJailBroken`, `canMockLocation`,
  `isDebuggedMode`, `hookDetected`).
- **Default behaviour**: warning banner + audit POST to
  `/api/v1/security/device-integrity` (Phase 3.6 backend stub — calls
  swallow 404s until the route ships).
- **Hard gate**: set `EXPO_PUBLIC_HARD_GATE_JAILBREAK=true` to switch
  the warning banner for a full-screen "device blocked" UI.
- Emulator / debugger detection runs on every app entry; the report is
  cached and digested into the `X-Device-Integrity` request header
  (`j=0;d=0;m=0;e=0;s=1`) on every axios call so the backend can rate-
  limit or step-up sensitive routes per session without re-running the
  native checks.

### Telemetry

Each suspicious result POSTs once on first detection (`outcome="warn"`
or `"block"`) and once again when the user dismisses the banner
(`outcome="acknowledged"`). The compact header is on every request so
log analysis can correlate without mining the audit table.

### Expo Go caveat

`jail-monkey` is a native module — it requires a custom dev client or
EAS build. In Expo Go (and on web), `device-integrity.ts` falls back to
safe defaults (everything `false`, signature `true`) so development
flows aren't blocked.
