---
name: update-app
description: Update dependencies, fix deprecations and warnings
---

# Dependency Update & Deprecation Fix

## Step 1: Check for Updates

```bash
cd /home/groot/amg-portal/frontend && npm outdated
cd /home/groot/amg-portal/backend && uv pip list --outdated
```

## Step 2: Update Dependencies

```bash
cd /home/groot/amg-portal/frontend && npm update && npm audit fix
cd /home/groot/amg-portal/backend && uv lock --upgrade && uv sync
```

## Step 3: Check for Deprecations & Warnings

```bash
cd /home/groot/amg-portal/frontend && rm -rf node_modules package-lock.json && npm install
cd /home/groot/amg-portal/backend && uv sync --reinstall
```

Read ALL output carefully. Look for:
- Deprecation warnings
- Security vulnerabilities
- Peer dependency warnings
- Breaking changes

## Step 4: Fix Issues

For each warning/deprecation:
1. Research the recommended replacement or fix
2. Update code/dependencies accordingly
3. Re-run installation
4. Verify no warnings remain

## Step 5: Run Quality Checks

```bash
cd /home/groot/amg-portal/backend && ruff check . && ruff format --check .
cd /home/groot/amg-portal/frontend && npx eslint . && npx tsc --noEmit
```

Fix all errors before completing.

## Step 6: Verify Clean Install

```bash
cd /home/groot/amg-portal/frontend && rm -rf node_modules package-lock.json && npm install
cd /home/groot/amg-portal/backend && uv sync --reinstall
```

Verify ZERO warnings/errors and all dependencies resolve correctly.
