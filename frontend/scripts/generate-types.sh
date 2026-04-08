#!/usr/bin/env bash
# Generate TypeScript types from the FastAPI OpenAPI schema.
#
# Usage:
#   ./scripts/generate-types.sh              # Backend must be running at localhost:8000
#   ./scripts/generate-types.sh --cached     # Use cached openapi.json (for CI/offline)
#   ./scripts/generate-types.sh --save-spec  # Save spec to openapi.json for offline use
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$(dirname "$SCRIPT_DIR")"
BACKEND_URL="${BACKEND_URL:-http://localhost:8000}"
SPEC_FILE="$FRONTEND_DIR/openapi.json"
OUTPUT="$FRONTEND_DIR/src/types/generated.ts"

case "${1:-}" in
  --cached)
    if [[ ! -f "$SPEC_FILE" ]]; then
      echo "ERROR: No cached spec at $SPEC_FILE" >&2
      echo "Run with --save-spec first, or start the backend and run without flags." >&2
      exit 1
    fi
    echo "Using cached spec: $SPEC_FILE"
    npx openapi-typescript "$SPEC_FILE" -o "$OUTPUT"
    ;;
  --save-spec)
    echo "Fetching spec from $BACKEND_URL/openapi.json ..."
    curl -sf "$BACKEND_URL/openapi.json" -o "$SPEC_FILE"
    echo "Saved spec to $SPEC_FILE"
    npx openapi-typescript "$SPEC_FILE" -o "$OUTPUT"
    ;;
  *)
    echo "Fetching spec from $BACKEND_URL/openapi.json ..."
    npx openapi-typescript "$BACKEND_URL/openapi.json" -o "$OUTPUT"
    ;;
esac

echo "Generated: $OUTPUT"
