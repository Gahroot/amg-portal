# Partner Invoice Submission Portal — Implementation Plan

## Overview
Implement a full invoice submission workflow for partners: create invoices with line items, upload PDF backup, submit for finance approval, and track status through paid. Finance users get notification and approve/reject; partner gets notified of outcome.

---

## Architecture Summary

- **New model**: `PartnerInvoice` — separate from existing `Invoice` (which is client-billing)
- **Partner API** (`/partner-portal/invoices`): CRUD + submit + upload endpoints (partner role only)
- **Internal API** (`/partner-invoices`): List all, approve, reject, mark paid (finance/coordinator/admin only)
- **Frontend**: Invoice list page + create form, both under `(partner)/partner/invoices/`
- **Notifications**: Finance notified on submit; partner notified on approve/reject

---

## Files to Create

### Backend

#### 1. `backend/app/models/partner_invoice.py`
```python
class PartnerInvoice(Base, TimestampMixin):
    __tablename__ = "partner_invoices"

    id: UUID primary_key
    partner_id: UUID → partner_profiles.id (NOT NULL, index)
    invoice_number: String(100) NOT NULL
    amount: Numeric(14,2) NOT NULL
    status: String(20) default="draft"  # draft|submitted|approved|rejected|paid
    due_date: Date nullable
    paid_date: Date nullable
    file_path: String(500) nullable  # MinIO object path for PDF
    line_items: JSON default=[]  # [{description, quantity, rate, amount}]
    notes: String(1000) nullable
    submitted_at: DateTime(tz) nullable
    reviewed_at: DateTime(tz) nullable
    reviewed_by: UUID → users.id nullable
    rejection_reason: String(500) nullable
    created_by: UUID → users.id NOT NULL

    # Relationships
    partner = relationship("PartnerProfile")
    reviewer = relationship("User", foreign_keys=[reviewed_by])
    creator = relationship("User", foreign_keys=[created_by])
```

#### 2. `backend/app/models/enums.py`
Add enum after `PartnerStatus`:
```python
class PartnerInvoiceStatus(StrEnum):
    draft = "draft"
    submitted = "submitted"
    approved = "approved"
    rejected = "rejected"
    paid = "paid"
```

#### 3. `backend/app/schemas/partner_invoice.py`
- `LineItem`: description (str), quantity (Decimal ≥0), rate (Decimal ≥0), amount (Decimal ≥0)
- `PartnerInvoiceCreate`: invoice_number, amount, due_date, line_items, notes
- `PartnerInvoiceUpdate`: amount, due_date, line_items, notes (all optional, only for drafts)
- `PartnerInvoiceResponse`: all fields + partner_firm_name, reviewer_name
- `PartnerInvoiceListResponse`: invoices: list[PartnerInvoiceResponse], total: int
- `ReviewRequest`: rejection_reason (optional, required if rejecting)

#### 4. `backend/app/api/v1/partner_invoices.py` (internal finance API)
Routes under `/partner-invoices`:
- `GET /` → list all invoices, filterable by status/partner_id (require_coordinator_or_above + finance)
- `GET /{id}` → get single (require_internal)
- `POST /{id}/approve` → set status=approved, reviewed_by, reviewed_at; notify partner (require_compliance)
- `POST /{id}/reject` → set status=rejected + rejection_reason; notify partner (require_compliance)
- `PATCH /{id}/mark-paid` → set status=paid, paid_date (require_compliance)
- `GET /{id}/download` → presigned URL for PDF (require_internal)

#### 5. Extend `backend/app/api/v1/partner_portal.py` (partner API)
Add at bottom of file, routes under `/partner-portal/invoices`:
- `GET /invoices` → partner's own invoices, filterable by status (CurrentPartner)
- `POST /invoices` → create draft (CurrentPartner)
- `GET /invoices/{id}` → get own invoice (CurrentPartner + ownership check)
- `PATCH /invoices/{id}` → update draft (CurrentPartner + ownership + status==draft)
- `POST /invoices/{id}/submit` → change draft→submitted, set submitted_at; notify finance users (CurrentPartner)
- `POST /invoices/{id}/upload` → upload PDF, set file_path (CurrentPartner + ownership + draft/submitted)
- `GET /invoices/{id}/download` → presigned URL (CurrentPartner + ownership)
- `DELETE /invoices/{id}` → delete draft only (CurrentPartner + ownership + status==draft)

#### 6. `backend/app/models/__init__.py`
Add: `from app.models.partner_invoice import PartnerInvoice  # noqa: F401`

#### 7. `backend/app/api/v1/router.py`
Add import + register:
```python
from app.api.v1.partner_invoices import router as partner_invoices_router
router.include_router(partner_invoices_router, prefix="/partner-invoices", tags=["partner-invoices"])
```

#### 8. `backend/alembic/versions/add_partner_invoices.py`
```python
revision = "add_partner_invoices"
down_revision = (
    "add_doc_req_status_tracking",
    "add_program_templates",
    "add_recurring_tasks",
    "add_pulse_surveys",
    "add_milestone_reminder_preferences",
    "add_escalation_rules",
    "add_notification_snooze_fields",
)
```
Creates `partner_invoices` table with all columns above. Indices on `partner_id`, `status`.

---

### Frontend

#### 9. `frontend/src/types/partner-invoice.ts`
```typescript
export type PartnerInvoiceStatus = "draft" | "submitted" | "approved" | "rejected" | "paid";

export interface LineItem {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

export interface PartnerInvoice {
  id: string;
  partner_id: string;
  invoice_number: string;
  amount: string;
  status: PartnerInvoiceStatus;
  due_date: string | null;
  paid_date: string | null;
  file_path: string | null;
  line_items: LineItem[];
  notes: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  rejection_reason: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  partner_firm_name: string | null;
  reviewer_name: string | null;
}

export interface PartnerInvoiceListResponse {
  invoices: PartnerInvoice[];
  total: number;
}

export interface PartnerInvoiceListParams {
  status?: string;
  skip?: number;
  limit?: number;
}
```

#### 10. `frontend/src/lib/api/partner-invoices.ts`
Functions using `api` (axios instance):
- `getMyInvoices(params?)` → `GET /api/v1/partner-portal/invoices`
- `getMyInvoice(id)` → `GET /api/v1/partner-portal/invoices/{id}`
- `createInvoice(data)` → `POST /api/v1/partner-portal/invoices`
- `updateInvoice(id, data)` → `PATCH /api/v1/partner-portal/invoices/{id}`
- `submitInvoice(id)` → `POST /api/v1/partner-portal/invoices/{id}/submit`
- `uploadInvoicePdf(id, file)` → `POST /api/v1/partner-portal/invoices/{id}/upload` (multipart)
- `getInvoiceDownloadUrl(id)` → `GET /api/v1/partner-portal/invoices/{id}/download`
- `deleteInvoice(id)` → `DELETE /api/v1/partner-portal/invoices/{id}`

#### 11. `frontend/src/hooks/use-partner-invoices.ts`
- `usePartnerInvoices(params?)` — query key `["partner-portal", "invoices", params]`
- `usePartnerInvoice(id)` — query key `["partner-portal", "invoices", id]`
- `useCreateInvoice()` — mutation, invalidates list
- `useUpdateInvoice()` — mutation
- `useSubmitInvoice()` — mutation, toast "Invoice submitted"
- `useUploadInvoicePdf()` — mutation, toast "PDF uploaded"
- `useDeleteInvoice()` — mutation, toast "Invoice deleted"

#### 12. `frontend/src/components/partner/invoice-form.tsx`
Form component `InvoiceForm` for creating/editing a draft invoice:
- Fields: invoice_number, amount, due_date, notes
- Dynamic line items table: description, quantity, rate → auto-calculate amount per line
- Auto-sum total amount from line items if line items present
- PDF upload section (after invoice is saved, show upload button)
- Submit for approval button (only shows if status === "draft")
- Uses `react-hook-form` pattern matching the codebase (or simple React state per existing patterns)
- On create: calls `createInvoice`, then optionally upload PDF
- On submit: calls `submitInvoice(id)`

#### 13. `frontend/src/app/(partner)/partner/invoices/page.tsx`
Invoice list page:
- Tab filters: All | Draft | Submitted | Approved | Rejected | Paid
- Table: invoice_number, amount, status badge, due_date, submitted_at, actions
- "New Invoice" button opens inline form or routes to `/partner/invoices/new`
- Download PDF button (if file_path exists)
- Status badges with colours matching other portal pages
- Empty state per tab
- Uses `usePartnerInvoices`, `useSubmitInvoice`, `useDeleteInvoice` hooks

#### 14. `frontend/src/config/partner-nav.ts`
Add nav item after "Deliverables":
```typescript
{
  title: "Invoices",
  href: "/partner/invoices",
  icon: Receipt,  // from lucide-react
  tooltip: "My Invoices",
},
```
Add `Receipt` to the lucide-react import.

---

## Implementation Order

1. `enums.py` — add `PartnerInvoiceStatus`
2. `models/partner_invoice.py` — model
3. `models/__init__.py` — register
4. `schemas/partner_invoice.py` — Pydantic schemas
5. `alembic/versions/add_partner_invoices.py` — migration
6. `api/v1/partner_invoices.py` — internal finance API
7. `api/v1/partner_portal.py` — add partner invoice routes
8. `api/v1/router.py` — register finance router
9. `types/partner-invoice.ts` — frontend types
10. `lib/api/partner-invoices.ts` — API client
11. `hooks/use-partner-invoices.ts` — React Query hooks
12. `components/partner/invoice-form.tsx` — form component
13. `app/(partner)/partner/invoices/page.tsx` — page
14. `config/partner-nav.ts` — nav item
15. Run `ruff check . && mypy .` (backend) + `npm run lint && npm run typecheck` (frontend)

---

## Notification Strategy

On `submit`: find all `finance_compliance` + `managing_director` users in DB, create `Notification` for each with `notification_type=approval_required`, action_url=`/partner-invoices/{id}`.

On `approve`/`reject`: find the partner's `user_id` from `PartnerProfile`, create `Notification` for them with `notification_type=approval_required`, action_url=`/partner/invoices`.

---

## Risks & Notes

- `line_items` stored as JSON for flexibility — no separate `InvoiceLineItem` table needed
- File upload validates content_type = `application/pdf` only (tighter restriction than default)
- Partner can only see their own invoices; ownership enforced via `partner_id == partner.id`
- Only `draft` invoices can be edited/deleted; submitted/approved cannot be modified by partner
- Migration uses all 7 current head revisions as `down_revision` to merge branches
