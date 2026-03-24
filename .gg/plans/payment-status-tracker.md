# Payment Status Tracker — Implementation Plan

## Overview
Partners need to track invoice payment status from submitted through to paid, with a timeline UI, notifications on status change, and payment details (method, reference, date).

## Key Findings

### Existing Invoice Model
- `backend/app/models/invoice.py` — basic model, statuses: `draft | sent | paid | overdue | cancelled`
- **Missing**: partner-specific invoice flow fields: `payment_method`, `payment_reference`, `estimated_payment_date`, `paid_at`, `submitted_at`, `reviewer_notes`, `partner_id`
- The current invoice model is client-centric (has `client_id`), not partner-centric

### Existing Invoice Schema/API
- `backend/app/schemas/invoice.py` — `VALID_STATUSES = {"draft", "sent", "paid", "overdue", "cancelled"}`
- `backend/app/api/v1/invoices.py` — internal-only CRUD, no partner access

### Status Flow Needed
`draft → submitted → under_review → approved → processing → paid` (or `rejected`)

### Notification Pattern
Use `notification_service.create_notification(db, CreateNotificationRequest(...))` from `app.services.notification_service`
Import `CreateNotificationRequest` from `app.schemas.notification`

### Current Head Migration
`add_partner_threshold` (confirmed via migration chain analysis)

### Frontend Patterns
- Hooks in `frontend/src/hooks/use-partner-portal.ts` use TanStack Query
- API calls in `frontend/src/lib/api/partner-portal.ts` use `api.get/post`
- Pages in `frontend/src/app/(partner)/partner/`
- Timeline UI pattern already exists in deliverable detail page

## Files to Create/Modify

### 1. `backend/app/models/invoice.py` (MODIFY)
Extend Invoice model with partner payment tracking fields:
- `partner_id` — FK to `partner_profiles.id`, nullable (partner who submitted the invoice)
- `submitted_at` — DateTime, when partner submitted
- `reviewed_at` — DateTime, when internal staff reviewed
- `approved_at` — DateTime, when approved
- `paid_at` — DateTime, when payment processed
- `payment_method` — String(100), e.g. "bank_transfer", "wire"
- `payment_reference` — String(255), payment ref/transaction ID
- `estimated_payment_date` — Date, nullable
- `reviewer_notes` — Text, nullable (for rejection reasons)

Update statuses: `draft | submitted | under_review | approved | processing | paid | rejected`

### 2. `backend/app/schemas/invoice.py` (MODIFY)
- Update `VALID_STATUSES` to include new statuses
- Add `PartnerInvoiceCreate` schema with partner-specific fields
- Add `PartnerInvoiceStatusUpdate` for internal status updates
- Extend `InvoiceResponse` with new fields
- Add `InvoiceStatusHistoryEntry` for timeline data
- Add `PartnerInvoiceListResponse`

### 3. `backend/alembic/versions/add_partner_invoice_tracking.py` (NEW)
Migration to add partner payment tracking columns to existing `invoices` table:
- `down_revision = "add_partner_threshold"`
- Add columns: `partner_id`, `submitted_at`, `reviewed_at`, `approved_at`, `paid_at`, `payment_method`, `payment_reference`, `estimated_payment_date`, `reviewer_notes`
- Add index on `partner_id`

### 4. `backend/app/api/v1/partner/invoices.py` (NEW)
Partner-facing invoice endpoints:
- `POST /partner-portal/invoices` — partner submits invoice (sets status=submitted, fires notification to RM/coordinator)
- `GET /partner-portal/invoices` — list partner's own invoices (scoped by partner_id)
- `GET /partner-portal/invoices/{invoice_id}` — get invoice detail with status timeline
- Uses `CurrentPartner` dependency

### 5. `backend/app/api/v1/invoices.py` (MODIFY)
Add internal status management endpoint:
- `POST /invoices/{invoice_id}/status` — internal staff update invoice status with optional notes/payment details; fires notification to partner

### 6. `backend/app/api/v1/router.py` (MODIFY)
Register the partner invoices router:
```python
from app.api.v1.partner.invoices import router as partner_invoices_router
router.include_router(partner_invoices_router, prefix="/partner-portal", tags=["partner-portal"])
```

### 7. `frontend/src/lib/api/partner-portal.ts` (MODIFY)
Add types and API functions:
```typescript
interface PartnerInvoice { id, partner_id, amount, status, submitted_at, reviewed_at, approved_at, paid_at, payment_method, payment_reference, estimated_payment_date, reviewer_notes, notes, created_at, updated_at }
interface PartnerInvoiceListResponse { invoices: PartnerInvoice[], total: number }
interface CreatePartnerInvoice { amount: number; notes?: string; estimated_payment_date?: string }

getMyInvoices(): Promise<PartnerInvoiceListResponse>
getMyInvoice(id: string): Promise<PartnerInvoice>
submitPartnerInvoice(data: CreatePartnerInvoice): Promise<PartnerInvoice>
```

### 8. `frontend/src/hooks/use-partner-portal.ts` (MODIFY)
Add hooks:
```typescript
useMyInvoices()
useMyInvoice(id: string)
useSubmitInvoice()
```

### 9. `frontend/src/components/partner/payment-tracker.tsx` (NEW)
Components:
- `PaymentStatusTimeline` — visual step-based timeline showing all statuses
  - Steps: Draft → Submitted → Under Review → Approved → Processing → Paid
  - Rejected shown as branching step
  - Current step highlighted with ring/glow
  - Completed steps filled/green
  - Future steps grayed out
  - Each step shows timestamp if completed
- `PaymentDetails` — payment method, reference number, paid date card
- `InvoiceStatusBadge` — badge variant per status

### 10. `frontend/src/app/(partner)/partner/invoices/[id]/page.tsx` (NEW)
Invoice detail page with:
- Invoice header (amount, status badge, dates)
- `PaymentStatusTimeline` component
- `PaymentDetails` card (only shown when paid/processing)
- Estimated payment date card
- Notes/reviewer notes cards
- Back button to invoices list

### 11. `frontend/src/app/(partner)/partner/invoices/page.tsx` (NEW)
Invoices list page:
- Table of invoices with status badges
- Amount, submitted date, estimated payment date
- Click row → navigate to detail page

## Notification Logic

**On invoice submitted (partner → internal):**
- Notify all coordinators/finance_compliance about new partner invoice submission
- In practice: find the partner's assigned coordinators or use a general internal notification
- Simplification: notify any user who created the partner's assignments

**On status change (internal → partner):**
```python
# Find partner's user_id from partner profile
await notification_service.create_notification(db, CreateNotificationRequest(
    user_id=partner.user_id,
    notification_type="assignment_update",  # reuse existing type
    title=f"Invoice status updated: {new_status}",
    body=f"Your invoice for {amount} has been {new_status}",
    action_url=f"/partner/invoices/{invoice_id}",
    entity_type="invoice",
    entity_id=invoice_id,
    priority="high" if new_status == "paid" else "normal",
))
```

## Status Timeline Data
Since we don't have a separate `invoice_status_history` table, derive the timeline from the timestamp columns:
- `created_at` → draft
- `submitted_at` → submitted
- `reviewed_at` → under_review
- `approved_at` → approved (or rejected)
- `paid_at` → paid

The timeline in the API response will be computed from these fields.

## Implementation Order
1. Modify `backend/app/models/invoice.py` (add partner fields)
2. Modify `backend/app/schemas/invoice.py` (update schemas)
3. Create migration `backend/alembic/versions/add_partner_invoice_tracking.py`
4. Create `backend/app/api/v1/partner/invoices.py` (partner endpoints)
5. Modify `backend/app/api/v1/invoices.py` (add internal status endpoint)
6. Modify `backend/app/api/v1/router.py` (register router)
7. Modify `frontend/src/lib/api/partner-portal.ts` (add API functions)
8. Modify `frontend/src/hooks/use-partner-portal.ts` (add hooks)
9. Create `frontend/src/components/partner/payment-tracker.tsx`
10. Create `frontend/src/app/(partner)/partner/invoices/[id]/page.tsx`
11. Create `frontend/src/app/(partner)/partner/invoices/page.tsx`
12. Run linting/type checks
