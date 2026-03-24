# RM Direct Communication Channel — Implementation Plan

## Current State
- `conversations.py` API: general conversation CRUD for internal users
- `partner_portal.py`: NO conversation endpoints (only profile, assignments, deliverables, etc.)
- Frontend `partner-portal.ts`: Already has `getMyConversations()`, `sendMessageToConversation()`, etc. calling `/api/v1/partner-portal/conversations/...` — **but those backend endpoints don't exist yet**
- Frontend `use-partner-portal.ts`: Already has conversation hooks (`usePartnerConversations`, etc.)
- Frontend messages pages (list + `[id]` detail): Already exist but back-end endpoints missing
- `ConversationType` enum: `rm_client`, `coordinator_partner`, `internal` — **no `rm_partner`**
- `communication_service.send_message()`: broadcasts via WebSocket but sends no in-app notifications

## What Needs to Be Built

### 1. `backend/app/models/enums.py` — Add `rm_partner` type
Add `rm_partner = "rm_partner"` to `ConversationType`.

### 2. `backend/app/services/conversation_service.py` — RM channel support
- Add `get_or_create_rm_partner_conversation(db, partner_user_id, rm_user_id, partner_profile_id)` method
- Update `validate_message_scope()` for `rm_partner`: partner can only message their RM, MDs can read/participate, no clients or other partners

### 3. `backend/app/services/communication_service.py` — Notifications on new message
- After broadcasting via WebSocket in `send_message()`, also send in-app notifications to all participants who aren't the sender (for `rm_partner` and `coordinator_partner` conversation types)

### 4. `backend/app/api/v1/partner_portal.py` — Add conversation + RM channel endpoints
New endpoints (all under `/partner-portal/`):
- `GET /conversations` — list partner's conversations (scoped to participant_ids containing partner's user_id)
- `GET /conversations/{id}` — get one conversation (must be participant)
- `GET /conversations/{id}/messages` — get messages
- `POST /conversations/{id}/messages` — send text message (body only, no files here)
- `POST /conversations/{id}/mark-read` — mark all read
- `GET /rm/direct-channel` — get or create direct RM channel
- `POST /conversations/{id}/attachments` — upload file attachment, returns `{attachment_id: "file:object_path", filename, size}`

The `GET /rm/direct-channel` logic:
1. Find existing `rm_partner` conversation where partner's user_id is in participant_ids
2. If none, find the partner's assigned RM: query `PartnerAssignment` where `partner_id == partner.id`, get `assigned_by` user(s) who have role `relationship_manager`, use most recent
3. If no RM found via assignments, try any coordinator from assignments
4. Create `rm_partner` conversation with `[partner.user_id, rm_user_id]`
5. Return conversation with enriched participants

For `send_message` in partner portal: support `attachment_ids` (list of "file:object_path" strings from prior attachment upload).

### 5. `frontend/src/lib/api/partner-portal.ts` — Add RM channel API functions
- `getRMDirectChannel(): Promise<Conversation>` — calls `GET /api/v1/partner-portal/rm/direct-channel`
- `uploadMessageAttachment(conversationId, file): Promise<{attachment_id, filename, size}>` — calls `POST /api/v1/partner-portal/conversations/{id}/attachments`
- Update `sendMessageToConversation()` to accept optional `attachment_ids: string[]`

### 6. `frontend/src/hooks/use-partner-portal.ts` — Add RM channel hooks
- `useRMDirectChannel()` — fetches RM direct channel
- `useUploadMessageAttachment()` — mutation for uploading

### 7. `frontend/src/components/partner/direct-message.tsx` (NEW)
Full RM direct messaging component:
- Header: RM name, role badge, "Secure Channel" lock icon
- Messages thread (with sender name, timestamp, read receipt checkmarks)
- File attachment support: button triggers file input, shows pending attachments, uploads before sending
- Compose area: textarea + attach button + send button
- Loading / empty states
- Polls every 5 seconds (via `usePartnerMessages` which already has `refetchInterval: 5000`)
- Shows `rm_partner` badge

### 8. `frontend/src/app/(partner)/partner/messages/page.tsx` — Update messages list
- Add "Direct RM Channel" section at the top using `useRMDirectChannel()`
- Show RM channel card with lock icon, RM name, unread badge
- Below: existing coordinator conversations list (unchanged)
- Show `rm_partner` type label as "RM Direct" instead of generic labels

### 9. `frontend/src/app/(partner)/partner/messages/[id]/page.tsx` — Update conversation view
- Use file attachment support from `direct-message.tsx` pattern when conversation type is `rm_partner`
- Show different header style for RM channel vs coordinator channel
- Actually: replace the inline message UI with `<DirectMessage conversationId={id} />` for all conversations, since `direct-message.tsx` is the full UI component

## Implementation Order
1. `enums.py` — add `rm_partner`
2. `conversation_service.py` — add `get_or_create_rm_partner_conversation` + update scope validation
3. `communication_service.py` — add notifications
4. `partner_portal.py` — add all conversation + RM channel endpoints
5. `partner-portal.ts` — add new API functions + update `sendMessageToConversation`
6. `use-partner-portal.ts` — add new hooks
7. `direct-message.tsx` — create component
8. `messages/page.tsx` — update to show RM channel
9. `messages/[id]/page.tsx` — update to use DirectMessage component
10. Run linters/type checks

## Visibility / Audit
- `rm_partner` conversations: only partner + RM + MDs (MDs can see all via participant_ids injection or role check)
- Scope enforcement in `validate_message_scope()` ensures partners can only message their assigned RM
- All messages stored in `communications` table with `conversation_id` linking to `conversations` — already auditable

## Notifications
- When partner sends message to RM: create `NotificationType.communication` notification for RM's user_id
- When RM sends message to partner: create `NotificationType.communication` notification for partner's user_id
- Both also receive WebSocket push (already handled)
