---
name: test
description: Run tests, then spawn parallel agents to fix failures
---

Run all tests for this project, collect failures, and use the subagent tool to spawn parallel sub-agents to fix them.

## Step 1: Run Tests

Run both backend and frontend tests in parallel:

```bash
# Backend — all tests (unit + integration)
cd backend && python3 -m pytest tests/ -v --tb=short 2>&1 | tail -40

# Backend — unit tests only (no database needed, fast)
cd backend && python3 -m pytest tests/test_unit_services.py -v --tb=short 2>&1 | tail -20

# Frontend — all tests
cd frontend && npx vitest run 2>&1 | tail -20

# Frontend — lib unit tests only (fast, no component rendering)
cd frontend && npx vitest run src/lib/__tests__/ 2>&1 | tail -20
```

### Useful Options

| Command | Purpose |
|---------|---------|
| `cd backend && python3 -m pytest tests/ -v` | Verbose output with test names |
| `cd backend && python3 -m pytest tests/ -x` | Stop on first failure |
| `cd backend && python3 -m pytest tests/ -k "test_auth"` | Run tests matching pattern |
| `cd backend && python3 -m pytest tests/ --cov=app --cov-report=term-missing` | Coverage report |
| `cd backend && python3 -m pytest tests/ -m "not slow"` | Skip slow tests |
| `cd frontend && npx vitest run --reporter=verbose` | Verbose frontend output |
| `cd frontend && npx vitest run src/lib/__tests__/validations.test.ts` | Single test file |
| `cd frontend && npx vitest` | Watch mode (interactive) |

### Database Note

Backend integration tests require PostgreSQL on port 5433 with the `amg_portal_test` database. If you see `DuplicateTableError` or connection errors:

```bash
# Reset the test database
docker compose up -d  # ensure PostgreSQL is running
cd backend && python3 -c "
import asyncio, asyncpg
async def reset():
    conn = await asyncpg.connect('postgresql://amg:amg_dev_password@localhost:5433/postgres')
    await conn.execute('DROP DATABASE IF EXISTS amg_portal_test')
    await conn.execute('CREATE DATABASE amg_portal_test')
    await conn.close()
    print('Test DB reset')
asyncio.run(reset())
"
```

## Step 2: If Failures

For each failing test, use the subagent tool to spawn a sub-agent (agent: "bee") to fix the underlying issue (not the test). Group related failures into a single sub-agent when they share a root cause.

### Example sub-agent prompts:

**For backend failures:**
```
The following backend tests are failing:
[test output with error messages]

Read the failing test files and the source code they test. Fix the underlying code issue
(the service/model/route), not the test. The tests are correct; the code has a bug.
After fixing, verify by running: cd backend && python3 -m pytest [specific_test_file] -v --tb=short
Use `mcp__grep__searchGitHub` (grepmcp) to find real-world examples of similar fixes — no need to reinvent the wheel.
```

**For frontend failures:**
```
The following frontend tests are failing:
[test output with error messages]

Read the failing test files and the source code they test. Fix the underlying code issue,
not the test. After fixing, verify by running: cd frontend && npx vitest run [specific_test_file]
Use `mcp__grep__searchGitHub` (grepmcp) to find real-world examples of similar fixes — no need to reinvent the wheel.
```

## Step 3: Re-run

Re-run the full test suite to verify all fixes:

```bash
cd backend && python3 -m pytest tests/ -v --tb=short 2>&1 | tail -40
cd frontend && npx vitest run 2>&1 | tail -20
```
