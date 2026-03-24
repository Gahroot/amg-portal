---
name: commit
description: Run checks, commit with AI message, and push
---

1. Run quality checks — fix ALL errors before continuing:
   ```
   cd backend && ruff check --fix . && mypy .
   cd frontend && npm run lint -- --fix && npm run typecheck
   ```

2. Review changes: run `git status`, `git diff --staged`, and `git diff`

3. Stage relevant files with `git add` (specific files, not -A)

4. Generate a concise commit message starting with a verb (Add/Update/Fix/Remove/Refactor)

5. Run `git commit -m "<message>"` then `git push`
