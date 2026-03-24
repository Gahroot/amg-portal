# Document Delivery Tracking — Implementation Plan

## Overview

Add package tracking-style delivery visibility across the portal and internal dashboard. The 5 stages are: **Uploaded → Sent → Downloaded → Viewed → Acknowledged**.

## What Already Exists

- `DocumentDelivery` model: has `delivered_at`, `viewed_at`, `acknowledged_at`
- `DeliveryTracker` component: basic table (needs redesign)
- Portal `GET /portal/documents` + single-doc endpoint
- `acknowledge_document` endpoint in portal
- `NotificationService.create_notification` available

## What Needs Building

### Backend

1. **`backend/app/models/document_delivery.py`** — add `downloaded_at` column
2. **`backend/app/schemas/document_delivery.py`** — add `downloaded_at` to `DocumentDeliveryResponse`
3. **`backend/app/api/v1/client_portal.py`** — add 3 new portal endpoints:
   - `POST /portal/documents/{id}/mark-viewed` — marks delivery `viewed_at` for current user
   - `POST /portal/documents/{id}/mark-downloaded` — marks delivery `downloaded_at` for current user; also notifies RM
   - `GET /portal/documents/{id}/delivery-status` — returns delivery stages for current user
4. **`backend/app/services/document_vault_service.py`** — in `deliver_document`, send in-portal notification to each recipient
5. **`backend/alembic/versions/add_delivery_downloaded_at.py`** — add `downloaded_at` column migration

### Frontend

6. **`frontend/src/types/document-delivery.ts`** — add `downloaded_at: string | null`
7. **`frontend/src/lib/api/client-portal.ts`** — add API fns:
   - `markDocumentViewed(id)` → `POST /portal/documents/{id}/mark-viewed`
   - `markDocumentDownloaded(id)` → `POST /portal/documents/{id}/mark-downloaded`
   - `getDocumentDeliveryStatus(id)` → `GET /portal/documents/{id}/delivery-status`
8. **`frontend/src/hooks/use-portal-documents.ts`** — add `useDocumentDeliveryStatus(id)`, `useMarkDocumentViewed()`, `useMarkDocumentDownloaded()`
9. **`frontend/src/components/documents/delivery-tracker.tsx`** — redesign from table to package tracking timeline (5 stages with icons, timestamps, status colors)
10. **`frontend/src/app/(portal)/portal/documents/page.tsx`** — add:
    - "New" badge on documents without `viewed_at`
    - call `mark-viewed` when row actions are expanded
    - "Delivery Status" button that opens a drawer/dialog with the DeliveryTracker timeline

## Stage Data Mapping

| Stage | Source |
|-------|--------|
| Uploaded | `Document.created_at` |
| Sent | `DocumentDelivery.delivered_at` |
| Downloaded | `DocumentDelivery.downloaded_at` (new) |
| Viewed | `DocumentDelivery.viewed_at` |
| Acknowledged | `DocumentAcknowledgment` record exists |

## Portal Delivery Status Response Shape

```json
{
  "document_id": "uuid",
  "file_name": "example.pdf",
  "uploaded_at": "ISO",
  "delivered_at": "ISO | null",
  "downloaded_at": "ISO | null",
  "viewed_at": "ISO | null",
  "acknowledged_at": "ISO | null",
  "current_stage": "uploaded | sent | downloaded | viewed | acknowledged"
}
```

## Notification Logic

- **On `deliver_document`**: for each recipient, create `deliverable_ready` notification: "A new document has been shared with you: {file_name}"
- **On `mark-downloaded`** (portal): notify uploader: "Client has downloaded: {file_name}"
- **On `mark-viewed`** (portal, only first time): no RM notification needed (keep it lightweight)

## Migration Chain

The latest migration is `add_escalation_playbooks`. New migration `add_delivery_downloaded_at` will depend on `add_escalation_playbooks`.

## Implementation Order

1. Backend model + schema (step 1, 2)
2. Migration (step 5)
3. Portal endpoints (step 3)
4. Notification in vault service (step 4)
5. Frontend types (step 6)
6. Frontend API client (step 7)
7. Frontend hooks (step 8)
8. Frontend tracker component redesign (step 9)
9. Frontend portal page update (step 10)
