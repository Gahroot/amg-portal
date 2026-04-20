#!/usr/bin/env bash
# compute-spki-pin.sh — print the SHA-256/Base64 SPKI fingerprint of a host's
# leaf certificate. Used to populate `expo.extra.certPins` in `app.json` for
# the AMG Portal mobile app (security-plan §6 Phase 3.6).
#
# Usage:
#   ./compute-spki-pin.sh api.amg-portal.com
#   ./compute-spki-pin.sh api.amg-portal.com 443
#
# The output Base64 string is what Android's <pin digest="SHA-256"> and iOS
# NSPinnedLeafIdentities[].SPKI-SHA256-BASE64 expect.
#
# Reference: https://developer.android.com/privacy-and-security/security-config#CertificatePinning

set -euo pipefail

if [[ $# -lt 1 || $# -gt 2 ]]; then
  echo "usage: $0 <host> [port]" >&2
  exit 64
fi

HOST="$1"
PORT="${2:-443}"

if ! command -v openssl >/dev/null 2>&1; then
  echo "openssl not found in PATH" >&2
  exit 69
fi

# `s_client </dev/null` — close stdin so openssl exits after the handshake.
# `-servername` is required for SNI, which most modern hosts (incl. Railway,
# Cloudflare) demand to return the right cert.
PIN=$(echo | \
  openssl s_client -servername "$HOST" -connect "${HOST}:${PORT}" 2>/dev/null \
  | openssl x509 -pubkey -noout \
  | openssl pkey -pubin -outform DER 2>/dev/null \
  | openssl dgst -sha256 -binary \
  | openssl enc -base64)

if [[ -z "${PIN}" ]]; then
  echo "failed to compute SPKI pin for ${HOST}:${PORT}" >&2
  exit 1
fi

printf 'host=%s\nport=%s\nspki_sha256_base64=%s\n' "$HOST" "$PORT" "$PIN"
