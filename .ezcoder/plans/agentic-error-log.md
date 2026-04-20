# Agentic Error Log

## Goal

Transform the existing passive error logger into an **agentic engineering log** — every error entry automatically describes *what the user was doing*, *what they clicked*, and *what they were trying to accomplish*, formatted so an AI coding agent can act on it immediately without needing to ask follow-up questions.

## Example Output (target format)

```
════════════════════════════════════════════════════════════════════════════════
[2026-04-03T14:22:11.403Z] NETWORK_ERROR

WHAT HAPPENED
  Page:     /clients/new
  Trigger:  Clicked "Save Contact" button
  Goal:     Create or save a new contact

TRAIL
  Navigated to /clients/new → Clicked "Individual" → Clicked "Save Contact" ← error here

ERROR
  Request:  POST /api/v1/clients → 422
  Message:  Request failed with status code 422
  Response: {"detail": [{"loc": ["body","email"],"msg":"value is not a valid email address"}]}

STACK
  AxiosError: Request failed with status code 422
    at settle (webpack-internal://...)
════════════════════════════════════════════════════════════════════════════════
```

## Architecture

### New file: `frontend/src/lib/action-context.ts`

A singleton module (no React dependency) that:

- **Tracks last interactive element clicked** — walks up the DOM from the click target to find the nearest `button`, `a`, `[role=button]`, `[role=menuitem]`, `input[type=submit]`. Extracts label in priority order: `data-action` attr → `aria-label` → `textContent` (trimmed, 60 char max) → `placeholder` → tag name.
- **Infers goal** from the label using keyword matching: save/create/add/submit/new → "Create or save…"; delete/remove/archive → "Delete or remove…"; approve/confirm → "Approve/confirm…"; edit/update → "Update…"; send/email/notify → "Send communication…"; upload/import → "Upload/import…"; download/export → "Download/export…"; fallback → `Complete action: "[label]"`.
- **Maintains a rolling 5-entry breadcrumb trail** (entries expire after 30 s of inactivity to avoid stale context).
- **Records navigation events** (popstate / hashchange) as `Navigated to /path` crumbs.
- Exports: `recordClick(el)`, `recordNavigation(url)`, `getActionContext()` → `{ trigger, goal, breadcrumbs }`.

No React, no hooks — plain module-level state so it works outside the React tree and is importable from the provider.

### Modified: `frontend/src/providers/error-logger-provider.tsx`

1. **Extend `ErrorEntry`** with: `trigger?: string`, `goal?: string`, `breadcrumbs?: string[]`.
2. **Add a capture-phase click listener** on `document` that calls `recordClick()` from `action-context.ts`. Uses capture phase so it fires even on buttons that `stopPropagation`.
3. **Add `popstate` + `hashchange` listeners** that call `recordNavigation()`.
4. **In `enqueue()`**: spread `getActionContext()` into every entry automatically — no callers need to change.
5. Clean up all new listeners in the `useEffect` teardown.

### Modified: `frontend/src/app/api/error-log/route.ts`

1. **Extend `ErrorEntry` interface** to match the provider (add `trigger`, `goal`, `breadcrumbs`).
2. **Rewrite the log formatter** into the narrative sectioned format shown above:
   - `WHAT HAPPENED` block — page pathname (stripped of origin), trigger, goal.
   - `TRAIL` block — breadcrumbs joined with ` → `, with ` ← error here` appended to the last item.
   - `ERROR` block — request line (if network), message, response body.
   - `STACK` block — stack trace + component stack (if present).
   - Omit any block entirely when its data is missing (e.g. no trail for a cold-load error).
3. Use `═` separator (double line) for better visual prominence in a terminal or log viewer.

## Opt-in enrichment (no breaking change)

Any component can add `data-action="create-contact"` or `data-goal="Create a new contact"` to a button for precision labeling. The tracker checks `dataset.action` and `dataset.goal` first. Zero components need to change for the system to work — this is just an escape hatch for ambiguous button text.

## What changes and what doesn't

| | Before | After |
|---|---|---|
| Page URL | ✅ | ✅ |
| Which button | ❌ | ✅ auto-tracked |
| User goal | ❌ | ✅ inferred from label |
| Action trail | ❌ | ✅ rolling 5-crumb history |
| Log format | flat key:value | narrative sections |
| Backend / API | unchanged | unchanged |
| Component changes required | none | none |

## Risks

- **Button text can be ambiguous** (e.g. icon-only buttons with no `aria-label`). Fallback is element type. Opt-in `data-action` solves this where needed.
- **Stale breadcrumbs**: 30 s TTL means a crumb from a previous workflow won't pollute a new error. This is intentional.
- **SSR**: `action-context.ts` guards all `window`/`document` access — safe in Node.js environments.

## Files Touched

- `frontend/src/lib/action-context.ts` — **new**
- `frontend/src/providers/error-logger-provider.tsx` — **modify**
- `frontend/src/app/api/error-log/route.ts` — **modify**

## Steps

1. Create `frontend/src/lib/action-context.ts` — singleton action tracker with click label extraction, goal inference, 5-entry breadcrumb trail, and navigation recording
2. Update `frontend/src/providers/error-logger-provider.tsx` — extend `ErrorEntry` with `trigger/goal/breadcrumbs`, add capture-phase click listener and nav listeners, spread `getActionContext()` into every enqueued entry
3. Update `frontend/src/app/api/error-log/route.ts` — extend `ErrorEntry` interface, rewrite log formatter to the narrative `WHAT HAPPENED / TRAIL / ERROR / STACK` sectioned format
