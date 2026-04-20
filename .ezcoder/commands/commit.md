---
name: commit
description: Run quality checks, commit with AI message, and push
---

1. Run ALL quality checks — fix every error before continuing:
   ```bash
   cd backend && ruff check --fix . && ruff check . && mypy .
   cd frontend && npm run lint -- --fix && npm run lint && npm run typecheck
   ```

2. Run `git status` and `git diff --staged` and `git diff` to review changes.

3. Stage relevant files with `git add` (specific files, never `-A`).

4. Generate a concise commit message starting with a verb (Add/Update/Fix/Remove/Refactor).

5. Run `git commit -m "<message>"` then `git push`.
