#!/usr/bin/env bash
#
# check-sri.sh — fail loudly when a third-party <Script>/<script>/<link>
# tag in the frontend lacks a Subresource Integrity (SRI) attribute.
#
# Implements the policy in docs/security-runbooks/sri-policy.md
# which is Phase 3.10 of docs/security-plan.md.
#
# Scans:
#   - frontend/src/app/         (Next.js routes)
#   - frontend/src/components/  (shared components)
#
# Patterns (case-insensitive, ERE):
#   - <Script src="https?://...">      (Next.js next/script)
#   - <script src="https?://...">      (raw HTML)
#   - <link ... rel="stylesheet" ... href="https?://..."> (stylesheets)
#
# A match is a VIOLATION if the same line lacks an `integrity=` attribute.
#
# Exit code:
#   0 — no violations (or no third-party loads at all).
#   1 — at least one violation; details printed to stderr.
#
# Usage (from repo root):
#   ./scripts/check-sri.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCAN_DIRS=(
  "${REPO_ROOT}/frontend/src/app"
  "${REPO_ROOT}/frontend/src/components"
)

violations=0
matches_total=0

# Combined ERE: any of the three third-party-load patterns.
PATTERN='(<[Ss]cript[^>]*src=["'"'"']https?://)|(<link[^>]*rel=["'"'"']stylesheet["'"'"'][^>]*href=["'"'"']https?://)|(<link[^>]*href=["'"'"']https?://[^"'"'"']*["'"'"'][^>]*rel=["'"'"']stylesheet)'

for dir in "${SCAN_DIRS[@]}"; do
  if [ ! -d "${dir}" ]; then
    echo "WARN: scan dir not found, skipping: ${dir}" >&2
    continue
  fi

  # Find every matching line. -EnH: ERE + line numbers + filename. -r: recurse.
  # We tolerate "no matches" (grep exits 1) without aborting under set -e.
  while IFS= read -r line; do
    [ -z "${line}" ] && continue
    matches_total=$((matches_total + 1))
    # Extract the file:lineno:content shape grep -EnH produces.
    # The line itself is what we inspect for `integrity=`.
    if ! echo "${line}" | grep -qiE 'integrity='; then
      echo "VIOLATION: missing integrity= attribute" >&2
      echo "  ${line}" >&2
      violations=$((violations + 1))
    fi
  done < <(find "${dir}" \
              -type f \
              \( -name '*.tsx' -o -name '*.ts' -o -name '*.jsx' -o -name '*.js' -o -name '*.html' \) \
              -print0 \
            | xargs -0 grep -EnH -e "${PATTERN}" 2>/dev/null || true)
done

echo
echo "==> SRI check complete."
echo "    Third-party load patterns found: ${matches_total}"
echo "    Violations (missing integrity=): ${violations}"

if [ "${violations}" -gt 0 ]; then
  echo
  echo "Fix per docs/security-runbooks/sri-policy.md §4 (generate sha384 hash)" >&2
  echo "and update the table in §3 with the pinned origin + version." >&2
  exit 1
fi

exit 0
