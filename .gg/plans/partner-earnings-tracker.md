# Partner Earnings / Revenue Tracker — Implementation Plan

## Overview
Add a full earnings and invoice tracking system for the partner portal.
Partners see lifetime earnings, YTD, monthly totals, pending payments,
invoice list, and a monthly chart. Internal staff can create/manage invoices
and payments for partners.

---

## Architecture Decisions

- **`PartnerInvoice`** — per-engagement invoice issued to a partner, linked to
  `PartnerAssignment` and `PartnerProfile`.
  Statuses: `draft | sent | pending | paid | overdue | cancelled`

- **`PartnerPayment`** — a payment record that settles (part of) an invoice.
  Statuses: `pending | processing | paid | failed | cancelled`

- `PartnerInvoice.service_type` stores the capability string for breakdown charts.

- The financial service computes all aggregate stats in-DB (no looping in Python).

- No seed data injection — the service returns clean zeros when no data exists.

- All new partner-facing routes are added to the **existing**
  `/api/v1/partner-portal` router (via a new file imported in `router.py`).

---

## Files to Create / Modify

### Backend
| File | Action |
|---|---|
| `backend/app/models/partner_payment.py` | **new** — PartnerInvoice + PartnerPayment ORM models |
| `backend/app/schemas/partner_payment.py` | **new** — Pydantic schemas |
| `backend/app/services/partner_financial_service.py` | **new** — business logic |
| `backend/app/api/v1/partner_earnings.py` | **new** — API routes |
| `backend/app/models/__init__.py` | **modify** — register new models |
| `backend/app/api/v1/router.py` | **modify** — include new router |
| `backend/alembic/versions/add_partner_payments.py` | **new** — DB migration |

### Frontend
| File | Action |
|---|---|
| `frontend/src/lib/api/partner-earnings.ts` | **new** — typed API client |
| `frontend/src/components/partner/earnings-dashboard.tsx` | **new** — dashboard component |
| `frontend/src/app/(partner)/partner/earnings/page.tsx` | **new** — page |
| `frontend/src/config/partner-nav.ts` | **modify** — add Earnings nav item |

---

## Step-by-Step Implementation

### Step 1 — ORM Model (`backend/app/models/partner_payment.py`)

```python
class PartnerInvoice(Base, TimestampMixin):
    __tablename__ = "partner_invoices"
    id: UUID
    partner_id: FK partner_profiles.id  # indexed
    assignment_id: FK partner_assignments.id nullable  # indexed
    invoice_number: str  # e.g. "INV-2026-001"
    amount: Numeric(14,2)
    currency: str default "USD"
    status: str  # draft | sent | pending | paid | overdue | cancelled
    service_type: str nullable  # capability label for breakdown
    description: str nullable
    issued_date: Date
    due_date: Date nullable
    paid_date: Date nullable
    notes: str nullable
    created_by: FK users.id nullable

class PartnerPayment(Base, TimestampMixin):
    __tablename__ = "partner_payments"
    id: UUID
    partner_id: FK partner_profiles.id  # indexed
    invoice_id: FK partner_invoices.id nullable  # indexed
    amount: Numeric(14,2)
    currency: str default "USD"
    status: str  # pending | processing | paid | failed | cancelled
    payment_method: str nullable  # bank_transfer | check | ach etc.
    reference: str nullable
    payment_date: Date nullable
    notes: str nullable
    created_by: FK users.id nullable
```

### Step 2 — Pydantic Schemas

- `PartnerInvoiceCreate`, `PartnerInvoiceUpdate`, `PartnerInvoiceResponse`
- `PartnerPaymentCreate`, `PartnerPaymentUpdate`, `PartnerPaymentResponse`
- `EarningsSummary` — total_lifetime, total_ytd, total_this_month, pending_amount, pending_count
- `EarningsChartPoint` — month (YYYY-MM), amount
- `ServiceBreakdown` — service_type, amount, percentage
- `EarningsDashboardResponse` — summary + chart + breakdown

### Step 3 — Financial Service

Methods:
- `get_earnings_summary(db, partner_id)` → `EarningsSummary`
  - Uses SQL aggregates: SUM paid invoices for lifetime / ytd / month
  - pending = SUM of pending/sent invoices
- `get_monthly_chart(db, partner_id, months=12)` → list[EarningsChartPoint]
  - GROUP BY year+month on paid invoices
- `get_service_breakdown(db, partner_id)` → list[ServiceBreakdown]
  - GROUP BY service_type on paid invoices
- `get_invoice_list(db, partner_id, skip, limit, status)` → paginated
- `get_payment_history(db, partner_id, skip, limit)` → paginated

### Step 4 — API Routes (`backend/app/api/v1/partner_earnings.py`)

All partner-facing routes (authenticated as `CurrentPartner`):

```
GET  /partner-portal/earnings/summary         → EarningsDashboardResponse
GET  /partner-portal/earnings/chart           → list[EarningsChartPoint]
GET  /partner-portal/invoices                 → paginated invoice list
GET  /partner-portal/invoices/{id}            → single invoice

Internal staff routes (require_internal):
POST /partner-invoices/                        → create invoice
PATCH /partner-invoices/{id}                  → update
POST /partner-payments/                        → record payment
```

Actually, for clean routing, partner-facing routes go under `/partner-portal`
prefix (already registered), and staff routes go under new `/partner-invoices`
and `/partner-payments` prefixes.

### Step 5 — Migration

`down_revision = "add_escalation_playbooks"` (latest head)

Creates `partner_invoices` and `partner_payments` tables with indexes.

### Step 6 — Frontend API Client

Typed functions:
- `getEarningsSummary()` → `EarningsDashboardResponse`
- `getEarningsChart(months?: number)` → `EarningsChartPoint[]`
- `getMyInvoices(params)` → paginated
- `getMyPaymentHistory(params)` → paginated

### Step 7 — Frontend Dashboard Component

`EarningsDashboard` component sections:
1. **Summary Cards row** — Total Lifetime | YTD | This Month | Pending
2. **Earnings Chart** — `recharts` BarChart, monthly, 12 months
3. **Service Breakdown** — small table or progress bars
4. **Invoice List** — Table with columns: Invoice #, Program/Assignment, Amount, Status, Due Date
5. **Payment History** — Table with: Date, Amount, Method, Reference, Status

Uses `useQuery` for data fetching. Loading skeletons. Empty states.

### Step 8 — Nav Item

Add to `partnerNavConfig` groups:
```ts
{
  title: "Earnings",
  href: "/partner/earnings",
  icon: DollarSign,
  tooltip: "Earnings & Invoices",
}
```

---

## Routing Summary

| Route | Auth | Tag |
|---|---|---|
| `GET /api/v1/partner-portal/earnings/summary` | partner | partner-earnings |
| `GET /api/v1/partner-portal/earnings/chart` | partner | partner-earnings |
| `GET /api/v1/partner-portal/invoices` | partner | partner-earnings |
| `GET /api/v1/partner-portal/invoices/{id}` | partner | partner-earnings |
| `POST /api/v1/partner-invoices/` | internal | partner-invoices |
| `PATCH /api/v1/partner-invoices/{id}` | internal | partner-invoices |
| `POST /api/v1/partner-payments/` | internal | partner-payments |
| `PATCH /api/v1/partner-payments/{id}` | internal | partner-payments |

---

## Quality Checks

After implementation:
```bash
cd backend && ruff check . && mypy .
cd frontend && npm run lint && npm run typecheck
```
