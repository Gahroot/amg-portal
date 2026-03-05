---
name: fix
description: Run typechecking and linting, then spawn parallel agents to fix all issues
---

# Project Code Quality Check

This command runs all linting and typechecking tools for this project, collects errors, groups them by domain, and spawns parallel agents to fix them.

## Step 1: Run Linting and Typechecking

Run ALL of the following commands and capture their output. Do not stop on failure — collect all errors:

**Frontend (from `frontend/` directory):**
```bash
cd frontend && npm run lint 2>&1; echo "---SEPARATOR---"; npm run typecheck 2>&1
```

**Backend (from `backend/` directory):**
```bash
cd backend && uv run ruff check . 2>&1; echo "---SEPARATOR---"; uv run mypy app/ 2>&1
```

## Step 2: Collect and Parse Errors

Parse the output from all commands. Group errors by domain:
- **Type errors (frontend)**: Issues from `tsc --noEmit`
- **Lint errors (frontend)**: Issues from `eslint`
- **Lint errors (backend)**: Issues from `ruff`
- **Type errors (backend)**: Issues from `mypy`

Create a list of all files with issues and the specific problems in each file.

If there are no errors across all tools, report success and stop.

## Step 3: Spawn Parallel Agents

For each domain that has issues, spawn an agent in parallel using the Task tool in a SINGLE response with MULTIPLE Task tool calls:

- Spawn a **"frontend-type-fixer"** agent for frontend TypeScript errors
- Spawn a **"frontend-lint-fixer"** agent for frontend ESLint errors
- Spawn a **"backend-lint-fixer"** agent for backend ruff errors
- Spawn a **"backend-type-fixer"** agent for backend mypy errors

Each agent should:
1. Receive the full list of files and specific errors in their domain
2. Fix all errors in their domain
3. Run the relevant check command to verify fixes
4. Report completion

## Step 4: Verify All Fixes

After all agents complete, run the full check suite again to ensure all issues are resolved. If issues remain, fix them directly.
