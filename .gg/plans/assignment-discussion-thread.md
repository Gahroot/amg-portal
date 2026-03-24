# Assignment Discussion Thread — Implementation Plan

## Overview
Add a threaded comment/discussion system to each assignment so partners, RMs, and coordinators can ask questions and collaborate in context.

## What Exists Already
- `ApprovalComment` model in `approval_comment.py` — threaded comments with parent_id, @mentions, is_internal
- `Notification` model + `notification_service.create_notification()` for in-app alerts
- Partner portal at `/api/v1/partner-portal/assignments/{id}` for partner-facing assignment endpoints
- Internal assignments at `/api/v1/assignments/{id}` for staff
- Frontend partner assignment detail at `app/(partner)/partner/assignments/[id]/page.tsx`
- Frontend internal assignment detail at `app/(dashboard)/assignments/[id]/page.tsx`

## Migration Heads
Current alembic heads: `add_deliverable_templates`, `add_partner_payments`

## Files to Create/Modify

### 1. `backend/app/models/assignment_comment.py` (NEW)
Model for threaded comments on assignments:
- `id`: UUID PK
- `assignment_id`: FK → `partner_assignments.id` (CASCADE delete), indexed
- `parent_id`: nullable FK → self (CASCADE delete), for replies
- `author_id`: FK → `users.id` (CASCADE delete)
- `content`: Text
- `is_internal`: Boolean, default False (False = partner-visible, True = internal staff only)
- `mentioned_user_ids`: ARRAY(UUID) default []
- `created_at`, `updated_at`: DateTime(timezone=True)
- Relationships: author, replies, parent, assignment

### 2. `backend/app/models/__init__.py` (MODIFY)
Add: `from app.models.assignment_comment import AssignmentComment  # noqa: F401`

### 3. `backend/app/schemas/assignment_comment.py` (NEW)
Pydantic schemas:
- `AssignmentCommentCreate`: content (str, 1–5000), parent_id (UUID | None), is_internal (bool = False), mentioned_user_ids (list[UUID] = [])
- `AssignmentCommentResponse`: id, assignment_id, parent_id, author_id, author_name, author_role, content, is_internal, mentioned_user_ids, created_at, updated_at, replies (list[AssignmentCommentResponse] | None)
- `AssignmentCommentList`: comments (list[AssignmentCommentResponse]), total (int)

### 4. `backend/app/api/v1/partner_portal.py` (MODIFY)
Add two new endpoints (partner-facing):
```
GET  /partner-portal/assignments/{assignment_id}/comments
POST /partner-portal/assignments/{assignment_id}/comments
```
- GET: Only returns comments where `is_internal=False`. Nested with replies.
- POST: Creates a new comment, always `is_internal=False` (partners can't create internal). Triggers notifications to assignment.assigner and internal staff users.
- Ownership check: `assignment.partner_id == partner.id`

### 5. `backend/app/api/v1/partner_assignments.py` (MODIFY)
Add endpoints for internal staff:
```
GET    /assignments/{assignment_id}/comments
POST   /assignments/{assignment_id}/comments
DELETE /assignments/{assignment_id}/comments/{comment_id}
```
- GET: Returns ALL comments (internal + external). Nested with replies.
- POST: Can set `is_internal=True/False`. Triggers notification to partner's user_id if `is_internal=False`.
- DELETE: Only author or MD/RM can delete.
- Dependencies: `require_internal`

### 6. `backend/alembic/versions/add_assignment_comments.py` (NEW)
Migration:
- `revision = "add_assignment_comments"`
- `down_revision = ("add_deliverable_templates", "add_partner_payments")`
- Creates `assignment_comments` table with all columns + indexes on `assignment_id`, `parent_id`, `author_id`

### 7. `frontend/src/lib/api/partner-portal.ts` (MODIFY)
Add types and API functions:
```ts
export interface AssignmentComment {
  id: string;
  assignment_id: string;
  parent_id: string | null;
  author_id: string;
  author_name: string | null;
  author_role: string | null;
  content: string;
  is_internal: boolean;
  mentioned_user_ids: string[];
  created_at: string;
  updated_at: string;
  replies?: AssignmentComment[];
}

export interface AssignmentCommentListResponse {
  comments: AssignmentComment[];
  total: number;
}

export async function getAssignmentComments(assignmentId: string): Promise<AssignmentCommentListResponse>
export async function addAssignmentComment(assignmentId: string, data: { content: string; parent_id?: string | null; mentioned_user_ids?: string[] }): Promise<AssignmentComment>
```

### 8. `frontend/src/hooks/use-partner-portal.ts` (MODIFY)
Add hooks:
```ts
export function useAssignmentComments(assignmentId: string)
export function useAddAssignmentComment(assignmentId: string)
```
- `useAssignmentComments`: polls every 10s for new comments
- `useAddAssignmentComment`: invalidates comments query on success, shows toast

### 9. `frontend/src/components/partner/assignment-thread.tsx` (NEW)
Full-featured thread component:
- Props: `assignmentId: string`
- Uses `useAssignmentComments` + `useAddAssignmentComment`
- Displays chronological list of top-level comments, each with nested replies
- Comment form at bottom with Textarea + "Send" button
- "Reply" button on each comment shows inline reply box
- @mention: parse `@word` in content and highlight with `<span className="text-blue-600">`
- Author badge (partner vs internal staff)
- Timestamp using `toLocaleDateString`
- Loading skeleton state
- Empty state: "No discussion yet. Ask a question below."

### 10. `frontend/src/app/(partner)/partner/assignments/[id]/page.tsx` (MODIFY)
Add `<AssignmentThread assignmentId={assignmentId} />` below the Deliverables section with heading "Discussion".

## Notification Logic (Backend)
When a comment is posted:
- If partner posts → notify assignment.assigner (the coordinator/RM who created it) via `notification_service.create_notification()` with type `"assignment_update"`, title `"New question on assignment: {title}"`, body = comment content snippet
- If internal staff posts (is_internal=False) → notify partner's user_id
- For @mentions (mentioned_user_ids) → notify each mentioned user

## API Response for Author Info
When building comment responses, join to User to get `full_name` and `role` and return as `author_name` and `author_role`.

## Implementation Order
1. Create AssignmentComment model
2. Register in __init__.py
3. Create schemas
4. Add alembic migration
5. Add partner_portal.py endpoints
6. Add partner_assignments.py endpoints
7. Add frontend API functions + types
8. Add frontend hooks
9. Create frontend component
10. Integrate into assignment detail page
11. Run backend lints + frontend lints
