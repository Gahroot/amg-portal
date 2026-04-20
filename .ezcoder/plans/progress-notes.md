# Deploy Blockers Progress Notes

## ALL PLAN STEPS COMPLETED (Steps 1-7)
Steps 1-7 are fully done. Step 8 (verification) is in progress.
- Backend Docker image builds ✅
- docker compose config validates ✅  
- Alembic: 90 migrations, no duplicates, single root ✅
- Frontend Docker image build fails due to pre-existing type errors (NOT from our changes)

## Pre-existing Type Errors Fixed So Far
1. `frontend/src/app/(dashboard)/certificates/new/page.tsx` - added `import DOMPurify from "isomorphic-dompurify"` after line 24
2. `frontend/src/components/clients/timeline-event.tsx` - line 237: removed `event.metadata.tags &&` guard, kept only `Array.isArray(event.metadata.tags) &&`
3. `frontend/src/components/communications/message-bubble.tsx` - added `import DOMPurify from "isomorphic-dompurify"` after `import { format } from "date-fns";`
4. `frontend/src/components/layout/split-view.tsx` - lines 410 and 437: changed `panel={leftPanel}` to `panel={leftPanel!}` and `panel={rightPanel}` to `panel={rightPanel!}`
5. `frontend/next.config.ts` - added `output: "standalone"` to nextConfig

## CURRENT ERROR TO FIX
File: `frontend/src/components/notifications/notification-center.tsx` line 114
Error: Type cast from `{ [key: string]: unknown; id: string; }` to Notification type fails
Current code: `notification={notification as Parameters<typeof NotificationItem>[0]["notification"]}`
Fix needed: Change to `notification={notification as unknown as Parameters<typeof NotificationItem>[0]["notification"]}`

## Files Created/Modified for Plan
- `backend/Dockerfile` - NEW (multi-stage: python:3.12-slim + uv builder + WeasyPrint runtime deps)
- `frontend/Dockerfile` - NEW (3-stage: node:22-alpine deps/builder/runtime with standalone)
- `.dockerignore` - NEW (root level)
- `backend/.dockerignore` - NEW
- `frontend/.dockerignore` - NEW
- `docker-compose.yml` - MODIFIED (added backend+frontend services, MinIO ports → 127.0.0.1)
- `frontend/next.config.ts` - MODIFIED (added output: "standalone")
- `backend/alembic/versions/add_notification_indexes.py` - MODIFIED (revision a1b2c3d4e5f6 → notif_indexes_01)
- `backend/alembic/versions/add_budget_approval_routing.py` - MODIFIED (down_revision None → ddc5d4fef8cd)
- `backend/alembic/versions/add_clearance_certificates.py` - MODIFIED (down_revision None → ddc5d4fef8cd)
- `backend/alembic/versions/add_escalation_response_deadline.py` - MODIFIED (down_revision None → ddc5d4fef8cd, removed branch_labels)
- `backend/alembic/versions/add_api_keys.py` - MODIFIED (down_revision None → ddc5d4fef8cd)
- `backend/alembic/versions/add_calendar_feed_tokens.py` - MODIFIED (down_revision None → ddc5d4fef8cd)
- `backend/alembic/versions/add_portal_feedback.py` - MODIFIED (down_revision None → ddc5d4fef8cd)
- `backend/.env.example` - already existed, no changes needed
