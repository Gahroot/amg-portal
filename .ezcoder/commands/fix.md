---
name: fix
description: Run typechecking and linting, then spawn parallel agents to fix all issues
---

Run all checks, collect errors, and spawn parallel sub-agents to fix them.

## Step 1: Run Checks

```bash
cd backend && ruff check . 2>&1; echo "==MYPY=="; mypy . 2>&1
cd frontend && npm run lint 2>&1; echo "==TSC=="; npm run typecheck 2>&1
```

Capture all output. If everything passes, report success and stop.

## Step 2: Group Errors

Parse output into domains:
- **Backend lint** — ruff errors
- **Backend types** — mypy errors
- **Frontend lint** — eslint errors
- **Frontend types** — tsc errors

## Step 3: Fix in Parallel

For each domain that has errors, use the `subagent` tool to spawn a sub-agent with:
- The full error list for that domain
- Instruction to fix every error (use `ruff check --fix .` for auto-fixable ruff issues)
- The relevant file paths
- Instruction to use `mcp__grep__searchGitHub` (grepmcp) to find real-world examples of similar fixes — no need to reinvent the wheel.

## Step 4: Verify

Re-run all checks from Step 1. If errors remain, repeat Steps 2–3. Report final status.
