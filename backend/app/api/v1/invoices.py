"""Invoice management endpoints."""

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select

from app.api.deps import DB, CurrentUser, RLSContext, require_coordinator_or_above, require_internal
from app.core.exceptions import BadRequestException, NotFoundException
from app.models.client import Client
from app.models.invoice import Invoice
from app.models.program import Program
from app.schemas.invoice import (
    VALID_STATUSES,
    InvoiceCreate,
    InvoiceListResponse,
    InvoiceResponse,
    InvoiceUpdate,
)

router = APIRouter()


@router.post("/", response_model=InvoiceResponse, status_code=201)
async def create_invoice(
    data: InvoiceCreate,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    _: None = Depends(require_coordinator_or_above),
) -> Any:
    client_result = await db.execute(select(Client).where(Client.id == data.client_id))
    if not client_result.scalar_one_or_none():
        raise NotFoundException("Client not found")

    if data.program_id:
        program_result = await db.execute(select(Program).where(Program.id == data.program_id))
        if not program_result.scalar_one_or_none():
            raise NotFoundException("Program not found")

    if data.status not in VALID_STATUSES:
        raise BadRequestException(f"Invalid status. Must be one of: {', '.join(sorted(VALID_STATUSES))}")

    invoice = Invoice(
        client_id=data.client_id,
        program_id=data.program_id,
        amount=data.amount,
        status=data.status,
        due_date=data.due_date,
        notes=data.notes,
        created_by=current_user.id,
    )
    db.add(invoice)
    await db.commit()
    await db.refresh(invoice)
    return invoice


@router.get("/", response_model=InvoiceListResponse)
async def list_invoices(
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    _: None = Depends(require_internal),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    client_id: UUID | None = None,
    program_id: UUID | None = None,
    status: str | None = None,
) -> InvoiceListResponse:
    query = select(Invoice)
    count_query = select(func.count()).select_from(Invoice)

    filters = []
    if client_id:
        filters.append(Invoice.client_id == client_id)
    if program_id:
        filters.append(Invoice.program_id == program_id)
    if status:
        filters.append(Invoice.status == status)

    for f in filters:
        query = query.where(f)
        count_query = count_query.where(f)

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.offset(skip).limit(limit).order_by(Invoice.created_at.desc())
    result = await db.execute(query)
    invoices = result.scalars().all()

    return InvoiceListResponse(invoices=list(invoices), total=total)  # type: ignore[arg-type]


@router.get("/{invoice_id}", response_model=InvoiceResponse)
async def get_invoice(
    invoice_id: UUID,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    _: None = Depends(require_internal),
) -> Any:
    result = await db.execute(select(Invoice).where(Invoice.id == invoice_id))
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise NotFoundException("Invoice not found")
    return invoice


@router.patch("/{invoice_id}", response_model=InvoiceResponse)
async def update_invoice(
    invoice_id: UUID,
    data: InvoiceUpdate,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    _: None = Depends(require_coordinator_or_above),
) -> Any:
    result = await db.execute(select(Invoice).where(Invoice.id == invoice_id))
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise NotFoundException("Invoice not found")

    update_data = data.model_dump(exclude_unset=True)

    if "status" in update_data and update_data["status"] not in VALID_STATUSES:
        raise BadRequestException(f"Invalid status. Must be one of: {', '.join(sorted(VALID_STATUSES))}")

    if "program_id" in update_data and update_data["program_id"] is not None:
        program_result = await db.execute(
            select(Program).where(Program.id == update_data["program_id"])
        )
        if not program_result.scalar_one_or_none():
            raise NotFoundException("Program not found")

    for field, value in update_data.items():
        setattr(invoice, field, value)

    await db.commit()
    await db.refresh(invoice)
    return invoice


@router.delete("/{invoice_id}", status_code=204)
async def delete_invoice(
    invoice_id: UUID,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    _: None = Depends(require_coordinator_or_above),
) -> None:
    result = await db.execute(select(Invoice).where(Invoice.id == invoice_id))
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise NotFoundException("Invoice not found")

    await db.delete(invoice)
    await db.commit()
