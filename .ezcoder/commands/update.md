---
name: update
description: Update dependencies, fix deprecations and warnings
---

## Step 1: Check for Updates

```bash
cd frontend && npm outdated || true
cd backend && uv lock --check 2>&1 || true
```

Review output and note available updates.

## Step 2: Update Dependencies

```bash
cd frontend && npm update && npm audit fix || true
cd backend && uv lock --upgrade && uv sync
```

## Step 3: Check for Deprecations & Warnings

Re-run installs and read ALL output carefully:
```bash
cd frontend && npm install 2>&1
cd backend && uv sync 2>&1
```

Look for deprecation warnings, security vulnerabilities, peer dependency conflicts, and breaking changes.

## Step 4: Fix Issues

For each warning or deprecation:
1. Research the recommended replacement (use web_fetch on migration guides or changelogs)
2. Update code and dependencies accordingly
3. Re-run installation and verify the warning is gone

## Step 5: Run Quality Checks

```bash
cd backend && ruff check --fix . && ruff check . && mypy .
cd frontend && npm run lint -- --fix && npm run lint && npm run typecheck
```

Fix ALL errors before continuing.

## Step 6: Verify Clean State

```bash
cd frontend && rm -rf node_modules && npm ci 2>&1
cd backend && uv sync 2>&1
```

Confirm ZERO warnings or errors in the output.
