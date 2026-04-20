"""Partner payment history API — view and record partner payments."""

import csv
import io
from datetime import date, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.api.deps import (
    DB,
    CurrentPartner,
    CurrentUser,
    RLSContext,
    require_coordinator_or_above,
    require_internal,
)
from app.core.exceptions import NotFoundException
from app.models.partner_assignment import PartnerAssignment
from app.models.partner_payment import PartnerPayment
from app.services.crud_base import paginate

router = APIRouter()

PAYMENT_METHODS = {
    "bank_transfer",
    "wire",
    "check",
    "ach",
    "paypal",
    "other",
}


# ─── Schemas ─────────────────────────────────────────────────────────────────


class PaymentCreate(BaseModel):
    assignment_id: UUID | None = None
    amount: Decimal = Field(..., gt=0, decimal_places=2)
    currency: str = Field("USD", min_length=3, max_length=3)
    payment_method: str = Field("bank_transfer")
    reference: str | None = Field(None, max_length=255)
    payment_date: date
    notes: str | None = Field(None, max_length=2000)


class PaymentResponse(BaseModel):
    id: UUID
    partner_id: UUID
    assignment_id: UUID | None
    amount: Decimal
    currency: str
    payment_method: str
    reference: str | None
    payment_date: date
    notes: str | None
    recorded_by: UUID
    assignment_title: str | None = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class PaymentListResponse(BaseModel):
    payments: list[PaymentResponse]
    total: int


class PaymentSummary(BaseModel):
    total_all_time: Decimal
    total_ytd: Decimal
    payment_count: int
    payment_count_ytd: int
    average_amount: Decimal | None


# ─── Helpers ─────────────────────────────────────────────────────────────────


def _build_response(p: PartnerPayment) -> PaymentResponse:
    return PaymentResponse(
        id=p.id,
        partner_id=p.partner_id,
        assignment_id=p.assignment_id,
        amount=p.amount,
        currency=p.currency,
        payment_method=p.payment_method,
        reference=p.reference,
        payment_date=p.payment_date,
        notes=p.notes,
        recorded_by=p.recorded_by,
        assignment_title=p.assignment.title if p.assignment else None,
        created_at=p.created_at,
        updated_at=p.updated_at,
    )


# ─── Partner-facing endpoints ────────────────────────────────────────────────

partner_router = APIRouter()


@partner_router.get("/payments", response_model=PaymentListResponse)
async def get_my_payments(
    db: DB,
    current_user: CurrentUser,
    partner: CurrentPartner,
    _rls: RLSContext,
    skip: int = Query(0, ge=0),
    limit: int = Query(25, ge=1, le=100),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    amount_min: Decimal | None = Query(None, ge=0),
    amount_max: Decimal | None = Query(None, ge=0),
    payment_method: str | None = Query(None),
) -> PaymentListResponse:
    """List all payments for the logged-in partner with optional filters."""
    q = (
        select(PartnerPayment)
        .options(selectinload(PartnerPayment.assignment))
        .where(PartnerPayment.partner_id == partner.id)
    )

    if date_from:
        q = q.where(PartnerPayment.payment_date >= date_from)
    if date_to:
        q = q.where(PartnerPayment.payment_date <= date_to)
    if amount_min is not None:
        q = q.where(PartnerPayment.amount >= amount_min)
    if amount_max is not None:
        q = q.where(PartnerPayment.amount <= amount_max)
    if payment_method:
        q = q.where(PartnerPayment.payment_method == payment_method)

    q = q.order_by(PartnerPayment.payment_date.desc())
    payments, total = await paginate(db, q, skip=skip, limit=limit)

    return PaymentListResponse(
        payments=[_build_response(p) for p in payments],
        total=total,
    )


@partner_router.get("/payments/summary", response_model=PaymentSummary)
async def get_my_payment_summary(
    db: DB,
    current_user: CurrentUser,
    partner: CurrentPartner,
    _rls: RLSContext,
) -> PaymentSummary:
    """Aggregated payment totals for the logged-in partner."""
    current_year = date.today().year
    ytd_start = date(current_year, 1, 1)

    # all-time totals
    all_time_result = await db.execute(
        select(func.sum(PartnerPayment.amount), func.count(PartnerPayment.id)).where(
            PartnerPayment.partner_id == partner.id
        )
    )
    all_time_row = all_time_result.one()
    total_all_time: Decimal = all_time_row[0] or Decimal("0.00")
    payment_count: int = all_time_row[1] or 0

    # YTD totals
    ytd_result = await db.execute(
        select(func.sum(PartnerPayment.amount), func.count(PartnerPayment.id)).where(
            PartnerPayment.partner_id == partner.id,
            PartnerPayment.payment_date >= ytd_start,
        )
    )
    ytd_row = ytd_result.one()
    total_ytd: Decimal = ytd_row[0] or Decimal("0.00")
    payment_count_ytd: int = ytd_row[1] or 0

    avg_amount: Decimal | None = (total_all_time / payment_count) if payment_count > 0 else None

    return PaymentSummary(
        total_all_time=total_all_time,
        total_ytd=total_ytd,
        payment_count=payment_count,
        payment_count_ytd=payment_count_ytd,
        average_amount=avg_amount,
    )


@partner_router.get("/payments/export/csv")
async def export_my_payments_csv(
    db: DB,
    current_user: CurrentUser,
    partner: CurrentPartner,
    _rls: RLSContext,
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    payment_method: str | None = Query(None),
) -> StreamingResponse:
    """Export partner's payment history as a CSV file."""
    q = (
        select(PartnerPayment)
        .options(selectinload(PartnerPayment.assignment))
        .where(PartnerPayment.partner_id == partner.id)
    )
    if date_from:
        q = q.where(PartnerPayment.payment_date >= date_from)
    if date_to:
        q = q.where(PartnerPayment.payment_date <= date_to)
    if payment_method:
        q = q.where(PartnerPayment.payment_method == payment_method)

    q = q.order_by(PartnerPayment.payment_date.desc())
    result = await db.execute(q)
    payments = result.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "Payment Date",
            "Amount",
            "Currency",
            "Payment Method",
            "Reference",
            "Assignment",
            "Notes",
        ]
    )
    for p in payments:
        writer.writerow(
            [
                p.payment_date.isoformat(),
                str(p.amount),
                p.currency,
                p.payment_method,
                p.reference or "",
                p.assignment.title if p.assignment else "",
                p.notes or "",
            ]
        )

    output.seek(0)
    filename = f"payments_{partner.firm_name.replace(' ', '_')}_{date.today().isoformat()}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ─── Internal endpoints (coordinators / finance) ─────────────────────────────

internal_router = APIRouter()


@internal_router.get("/", response_model=PaymentListResponse)
async def list_partner_payments(
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    _: None = Depends(require_internal),
    partner_id: UUID | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(25, ge=1, le=100),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    payment_method: str | None = Query(None),
) -> PaymentListResponse:
    """List all partner payments (internal staff view)."""
    q = select(PartnerPayment).options(selectinload(PartnerPayment.assignment))

    if partner_id:
        q = q.where(PartnerPayment.partner_id == partner_id)
    if date_from:
        q = q.where(PartnerPayment.payment_date >= date_from)
    if date_to:
        q = q.where(PartnerPayment.payment_date <= date_to)
    if payment_method:
        q = q.where(PartnerPayment.payment_method == payment_method)

    q = q.order_by(PartnerPayment.payment_date.desc())
    payments, total = await paginate(db, q, skip=skip, limit=limit)

    return PaymentListResponse(
        payments=[_build_response(p) for p in payments],
        total=total,
    )


@internal_router.post("/", response_model=PaymentResponse, status_code=201)
async def create_partner_payment(
    data: PaymentCreate,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    partner_id: UUID = Query(..., description="Partner profile ID"),
    _: None = Depends(require_coordinator_or_above),
) -> Any:
    """Record a new payment for a partner (internal staff only)."""
    if data.assignment_id:
        assignment_result = await db.execute(
            select(PartnerAssignment).where(PartnerAssignment.id == data.assignment_id)
        )
        if not assignment_result.scalar_one_or_none():
            raise NotFoundException("Assignment not found")

    payment = PartnerPayment(
        partner_id=partner_id,
        assignment_id=data.assignment_id,
        amount=data.amount,
        currency=data.currency.upper(),
        payment_method=data.payment_method,
        reference=data.reference,
        payment_date=data.payment_date,
        notes=data.notes,
        recorded_by=current_user.id,
    )
    db.add(payment)
    await db.commit()
    await db.refresh(payment)

    # reload with relationship
    result = await db.execute(
        select(PartnerPayment)
        .options(selectinload(PartnerPayment.assignment))
        .where(PartnerPayment.id == payment.id)
    )
    payment = result.scalar_one()
    return _build_response(payment)
