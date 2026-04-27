"""Compliance endpoints — Phase 2.8, 2.13, 2.14, 2.15.

* Break-glass (2.8): two-person approval → scoped JWT → audited access.
* Data export (2.13): user-initiated bundle of their own data.
* Erasure (2.14): two-person approval → crypto-shred subject keys.
* Consent (2.15): grant + revoke + history.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.api.deps import (
    DB,
    CurrentUser,
    require_admin,
    require_compliance,
    require_step_up,
)
from app.core.config import settings
from app.core.exceptions import (
    ConflictException,
    ForbiddenException,
    NotFoundException,
)
from app.core.security import create_break_glass_token
from app.models.break_glass_request import BreakGlassRequest
from app.models.client_profile import ClientProfile
from app.models.communication import Communication
from app.models.consent_log import ConsentLog
from app.models.document import Document
from app.models.enums import AuditAction, UserRole
from app.models.erasure_request import ErasureRequest
from app.schemas.base import Str50, Str100, Str500, Str2000
from app.services.audit_service import log_action
from app.services.crypto_shred import shred_subject

router = APIRouter()


# ── Schemas ─────────────────────────────────────────────────


class BreakGlassCreate(BaseModel):
    resource_type: Str50
    resource_id: uuid.UUID
    action_scope: list[Str50] = Field(..., min_length=1, max_length=10)
    justification: Str2000


class BreakGlassReject(BaseModel):
    rejection_reason: Str500


class ErasureCreate(BaseModel):
    subject_type: Str50
    subject_id: uuid.UUID
    reason: Str2000


class ErasureReject(BaseModel):
    rejection_reason: Str500


class ConsentGrant(BaseModel):
    consent_type: Str100
    scope: Str500 | None = None
    version: Str50 | None = None
    metadata_json: dict[str, Any] | None = None


class ConsentRevoke(BaseModel):
    consent_type: Str100
    scope: Str500 | None = None


# ── 2.8 — Break-glass ───────────────────────────────────────


@router.post("/break-glass/request", status_code=status.HTTP_201_CREATED)
async def break_glass_request(
    data: BreakGlassCreate, current_user: CurrentUser, db: DB
) -> dict[str, Any]:
    """Submit a break-glass request.  Pending until compliance approves."""
    now = datetime.now(UTC)
    req = BreakGlassRequest(
        requested_by=current_user.id,
        resource_type=data.resource_type,
        resource_id=data.resource_id,
        action_scope=",".join(data.action_scope),
        justification=data.justification,
        requested_at=now,
        status="pending",
    )
    db.add(req)
    await db.flush()
    await log_action(
        db,
        action=AuditAction.break_glass_requested,
        entity_type="break_glass_requests",
        entity_id=str(req.id),
        user=current_user,
        after_state={
            "resource_type": data.resource_type,
            "resource_id": str(data.resource_id),
            "action_scope": data.action_scope,
        },
    )
    await db.commit()
    return {"id": str(req.id), "status": req.status}


@router.post(
    "/break-glass/{request_id}/approve",
    dependencies=[Depends(require_compliance)],
)
async def break_glass_approve(
    request_id: uuid.UUID, current_user: CurrentUser, db: DB
) -> dict[str, Any]:
    """Compliance approves a pending request and issues the scoped JWT."""
    req = (
        await db.execute(select(BreakGlassRequest).where(BreakGlassRequest.id == request_id))
    ).scalar_one_or_none()
    if req is None:
        raise NotFoundException("Break-glass request not found")
    if req.status != "pending":
        raise ConflictException(f"Request is already '{req.status}'")
    if req.requested_by == current_user.id:
        raise ForbiddenException("Approver must be different from requester")

    now = datetime.now(UTC)
    ttl = settings.BREAK_GLASS_TOKEN_EXPIRE_MINUTES
    req.approved_by = current_user.id
    req.approved_at = now
    req.status = "approved"
    req.expires_at = now + timedelta(minutes=ttl)

    token = create_break_glass_token(
        {"sub": str(req.requested_by)},
        action_scope=req.action_scope.split(","),
        resource_ids=[str(req.resource_id)],
        justification=req.justification,
        ttl_minutes=ttl,
    )
    await log_action(
        db,
        action=AuditAction.break_glass_approved,
        entity_type="break_glass_requests",
        entity_id=str(req.id),
        user=current_user,
        after_state={
            "resource_id": str(req.resource_id),
            "approver_id": str(current_user.id),
            "ttl_minutes": ttl,
        },
    )
    await db.commit()
    return {
        "id": str(req.id),
        "status": req.status,
        "break_glass_token": token,
        "expires_at": req.expires_at.isoformat() if req.expires_at else None,
    }


@router.post(
    "/break-glass/{request_id}/reject",
    dependencies=[Depends(require_compliance)],
)
async def break_glass_reject(
    request_id: uuid.UUID,
    data: BreakGlassReject,
    current_user: CurrentUser,
    db: DB,
) -> dict[str, Any]:
    req = (
        await db.execute(select(BreakGlassRequest).where(BreakGlassRequest.id == request_id))
    ).scalar_one_or_none()
    if req is None:
        raise NotFoundException("Break-glass request not found")
    if req.status != "pending":
        raise ConflictException(f"Request is already '{req.status}'")

    req.approved_by = current_user.id
    req.approved_at = datetime.now(UTC)
    req.status = "rejected"
    req.rejection_reason = data.rejection_reason
    await log_action(
        db,
        action=AuditAction.break_glass_rejected,
        entity_type="break_glass_requests",
        entity_id=str(req.id),
        user=current_user,
        after_state={"reason": data.rejection_reason},
    )
    await db.commit()
    return {"id": str(req.id), "status": req.status}


@router.get("/break-glass")
async def break_glass_list(
    current_user: CurrentUser,
    db: DB,
    status_filter: str | None = None,
) -> list[dict[str, Any]]:
    """List break-glass requests (staff) — requester-scoped for non-staff."""
    query = select(BreakGlassRequest).order_by(BreakGlassRequest.requested_at.desc())
    if status_filter:
        query = query.where(BreakGlassRequest.status == status_filter)
    internal = {
        UserRole.managing_director.value,
        UserRole.finance_compliance.value,
    }
    if current_user.role not in internal:
        query = query.where(BreakGlassRequest.requested_by == current_user.id)
    rows = (await db.execute(query)).scalars().all()
    return [
        {
            "id": str(r.id),
            "requested_by": str(r.requested_by),
            "approved_by": str(r.approved_by) if r.approved_by else None,
            "resource_type": r.resource_type,
            "resource_id": str(r.resource_id),
            "action_scope": r.action_scope.split(","),
            "justification": r.justification,
            "status": r.status,
            "requested_at": r.requested_at.isoformat(),
            "approved_at": r.approved_at.isoformat() if r.approved_at else None,
            "expires_at": r.expires_at.isoformat() if r.expires_at else None,
            "consumed_at": r.consumed_at.isoformat() if r.consumed_at else None,
        }
        for r in rows
    ]


# ── 2.14 — Crypto-shred erasure ─────────────────────────────


@router.post("/erasure/request", status_code=status.HTTP_201_CREATED)
async def erasure_request(data: ErasureCreate, current_user: CurrentUser, db: DB) -> dict[str, Any]:
    """Submit a crypto-shred erasure request.  Two-person approval required."""
    now = datetime.now(UTC)
    req = ErasureRequest(
        requested_by=current_user.id,
        subject_type=data.subject_type,
        subject_id=data.subject_id,
        reason=data.reason,
        requested_at=now,
        status="pending",
    )
    db.add(req)
    await db.flush()
    await log_action(
        db,
        action=AuditAction.erasure_requested,
        entity_type="erasure_requests",
        entity_id=str(req.id),
        user=current_user,
        after_state={
            "subject_type": data.subject_type,
            "subject_id": str(data.subject_id),
        },
    )
    await db.commit()
    return {"id": str(req.id), "status": req.status}


@router.post(
    "/erasure/{request_id}/approve",
    dependencies=[
        Depends(require_admin),
        Depends(require_step_up("erasure_approve")),
    ],
)
async def erasure_approve(
    request_id: uuid.UUID, current_user: CurrentUser, db: DB
) -> dict[str, Any]:
    """Approve + execute a pending erasure request.

    Two guards: MD-level approval *and* step-up auth (action_scope:
    ``erasure_approve``).  The approver cannot be the requester.
    """
    req = (
        await db.execute(select(ErasureRequest).where(ErasureRequest.id == request_id))
    ).scalar_one_or_none()
    if req is None:
        raise NotFoundException("Erasure request not found")
    if req.status != "pending":
        raise ConflictException(f"Request is already '{req.status}'")
    if req.requested_by == current_user.id:
        raise ForbiddenException("Approver must be different from requester")

    now = datetime.now(UTC)
    manifest = await shred_subject(
        db,
        subject_type=req.subject_type,
        subject_id=req.subject_id,
        actor=current_user,
        reason=req.reason,
    )
    req.approved_by = current_user.id
    req.approved_at = now
    req.executed_at = now
    req.status = "executed"
    req.shred_manifest = manifest

    await log_action(
        db,
        action=AuditAction.erasure_executed,
        entity_type="erasure_requests",
        entity_id=str(req.id),
        user=current_user,
        after_state=manifest,
    )
    await db.commit()
    return {"id": str(req.id), "status": req.status, "manifest": manifest}


@router.post(
    "/erasure/{request_id}/reject",
    dependencies=[Depends(require_admin)],
)
async def erasure_reject(
    request_id: uuid.UUID,
    data: ErasureReject,
    current_user: CurrentUser,
    db: DB,
) -> dict[str, Any]:
    req = (
        await db.execute(select(ErasureRequest).where(ErasureRequest.id == request_id))
    ).scalar_one_or_none()
    if req is None:
        raise NotFoundException("Erasure request not found")
    if req.status != "pending":
        raise ConflictException(f"Request is already '{req.status}'")

    req.approved_by = current_user.id
    req.approved_at = datetime.now(UTC)
    req.status = "rejected"
    req.rejection_reason = data.rejection_reason
    await log_action(
        db,
        action=AuditAction.erasure_rejected,
        entity_type="erasure_requests",
        entity_id=str(req.id),
        user=current_user,
        after_state={"reason": data.rejection_reason},
    )
    await db.commit()
    return {"id": str(req.id), "status": req.status}


# ── 2.15 — Consent log ──────────────────────────────────────


@router.post("/consent/grant")
async def consent_grant(
    data: ConsentGrant, request: Request, current_user: CurrentUser, db: DB
) -> dict[str, Any]:
    now = datetime.now(UTC)
    row = ConsentLog(
        user_id=current_user.id,
        consent_type=data.consent_type,
        scope=data.scope,
        version=data.version,
        granted=True,
        effective_at=now,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent", "")[:2000] or None,
        metadata_json=data.metadata_json,
    )
    db.add(row)
    await db.flush()
    await log_action(
        db,
        action=AuditAction.consent_granted,
        entity_type="consent_log",
        entity_id=str(row.id),
        user=current_user,
        after_state={
            "consent_type": data.consent_type,
            "scope": data.scope,
            "version": data.version,
        },
    )
    await db.commit()
    return {"id": str(row.id), "granted": True, "effective_at": now.isoformat()}


@router.post("/consent/revoke")
async def consent_revoke(data: ConsentRevoke, current_user: CurrentUser, db: DB) -> dict[str, Any]:
    now = datetime.now(UTC)
    row = ConsentLog(
        user_id=current_user.id,
        consent_type=data.consent_type,
        scope=data.scope,
        granted=False,
        effective_at=now,
        revoked_at=now,
    )
    db.add(row)
    await db.flush()
    await log_action(
        db,
        action=AuditAction.consent_revoked,
        entity_type="consent_log",
        entity_id=str(row.id),
        user=current_user,
        after_state={"consent_type": data.consent_type, "scope": data.scope},
    )
    await db.commit()
    return {"id": str(row.id), "granted": False, "revoked_at": now.isoformat()}


@router.get("/consent/history")
async def consent_history(current_user: CurrentUser, db: DB) -> list[dict[str, Any]]:
    rows = (
        (
            await db.execute(
                select(ConsentLog)
                .where(ConsentLog.user_id == current_user.id)
                .order_by(ConsentLog.effective_at.desc())
            )
        )
        .scalars()
        .all()
    )
    return [
        {
            "id": str(r.id),
            "consent_type": r.consent_type,
            "scope": r.scope,
            "version": r.version,
            "granted": r.granted,
            "effective_at": r.effective_at.isoformat(),
            "revoked_at": r.revoked_at.isoformat() if r.revoked_at else None,
        }
        for r in rows
    ]


# ── 2.13 — Data export (GDPR Art. 20) ───────────────────────


@router.get(
    "/export/me",
    dependencies=[Depends(require_step_up("data_export"))],
)
async def export_my_data(current_user: CurrentUser, db: DB) -> dict[str, Any]:
    """Bundle the caller's own data in JSON.  Step-up required."""
    profile = (
        await db.execute(select(ClientProfile).where(ClientProfile.user_id == current_user.id))
    ).scalar_one_or_none()

    my_messages = (
        (await db.execute(select(Communication).where(Communication.sender_id == current_user.id)))
        .scalars()
        .all()
    )

    my_documents = (
        (await db.execute(select(Document).where(Document.uploaded_by == current_user.id)))
        .scalars()
        .all()
    )

    my_consents = (
        (await db.execute(select(ConsentLog).where(ConsentLog.user_id == current_user.id)))
        .scalars()
        .all()
    )

    bundle: dict[str, Any] = {
        "exported_at": datetime.now(UTC).isoformat(),
        "user": {
            "id": str(current_user.id),
            "email": current_user.email,
            "full_name": current_user.full_name,
            "role": current_user.role,
            "created_at": current_user.created_at.isoformat()
            if getattr(current_user, "created_at", None)
            else None,
        },
        "client_profile": (
            {
                "id": str(profile.id),
                "legal_name": getattr(profile, "legal_name", None),
                "primary_email": getattr(profile, "primary_email", None),
                "created_at": profile.created_at.isoformat(),
            }
            if profile
            else None
        ),
        "communications": [
            {
                "id": str(m.id),
                "subject": m.subject,
                "body": m.body,
                "conversation_id": str(m.conversation_id) if m.conversation_id else None,
                "sent_at": m.sent_at.isoformat() if m.sent_at else None,
                "created_at": m.created_at.isoformat(),
            }
            for m in my_messages
        ],
        "documents": [
            {
                "id": str(d.id),
                "file_name": d.file_name,
                "file_size": d.file_size,
                "category": d.category,
                "sha256": d.sha256,
                "crypto_shredded": d.crypto_shredded,
                "created_at": d.created_at.isoformat(),
            }
            for d in my_documents
        ],
        "consents": [
            {
                "consent_type": c.consent_type,
                "scope": c.scope,
                "granted": c.granted,
                "effective_at": c.effective_at.isoformat(),
                "revoked_at": c.revoked_at.isoformat() if c.revoked_at else None,
            }
            for c in my_consents
        ],
    }

    await log_action(
        db,
        action=AuditAction.data_export,
        entity_type="users",
        entity_id=str(current_user.id),
        user=current_user,
        after_state={
            "counts": {
                "communications": len(my_messages),
                "documents": len(my_documents),
                "consents": len(my_consents),
            }
        },
    )
    await db.commit()
    return bundle
