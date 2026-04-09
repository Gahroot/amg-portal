"""Compliance clearance certificate API endpoints."""

import contextlib
from typing import Any, cast
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import DB, CurrentUser, require_compliance, require_internal
from app.core.exceptions import BadRequestException, NotFoundException
from app.models.clearance_certificate import (
    CertificateTemplate,
    ClearanceCertificate,
    ClearanceCertificateHistory,
)
from app.models.client import Client
from app.models.program import Program
from app.schemas.clearance_certificate import (
    CertificatePreviewRequest,
    CertificatePreviewResponse,
    CertificateTemplateCreate,
    CertificateTemplateListResponse,
    CertificateTemplateResponse,
    CertificateTemplateUpdate,
    ClearanceCertificateCreate,
    ClearanceCertificateDetailResponse,
    ClearanceCertificateIssue,
    ClearanceCertificateListResponse,
    ClearanceCertificateResponse,
    ClearanceCertificateRevoke,
    ClearanceCertificateUpdate,
)
from app.services.certificate_service import certificate_service
from app.services.crud_base import paginate
from app.services.storage import storage_service

router = APIRouter()


# ============================================================================
# Certificate Templates
# ============================================================================

@router.post("/templates", response_model=CertificateTemplateResponse, status_code=201)
async def create_template(
    data: CertificateTemplateCreate,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_compliance),
) -> CertificateTemplateResponse:
    """Create a new certificate template."""
    template = CertificateTemplate(
        name=data.name,
        description=data.description,
        template_type=data.template_type,
        content=data.content,
        placeholders=data.placeholders,
        is_active=data.is_active,
        created_by=current_user.id,
    )
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return CertificateTemplateResponse.model_validate(template)


@router.get("/templates", response_model=CertificateTemplateListResponse)
async def list_templates(
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_internal),
    template_type: str | None = None,
    is_active: bool | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
) -> CertificateTemplateListResponse:
    """List certificate templates."""
    query = select(CertificateTemplate)

    if template_type:
        query = query.where(CertificateTemplate.template_type == template_type)
    if is_active is not None:
        query = query.where(CertificateTemplate.is_active == is_active)

    query = query.order_by(CertificateTemplate.created_at.desc())
    templates, total = await paginate(db, query, skip=skip, limit=limit)

    return CertificateTemplateListResponse(
        templates=[CertificateTemplateResponse.model_validate(t) for t in templates],
        total=total,
    )


@router.get("/templates/{template_id}", response_model=CertificateTemplateResponse)
async def get_template(
    template_id: UUID,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_internal),
) -> CertificateTemplateResponse:
    """Get a specific template."""
    result = await db.execute(
        select(CertificateTemplate).where(CertificateTemplate.id == template_id)
    )
    template = result.scalar_one_or_none()
    if not template:
        raise NotFoundException("Template not found")
    return CertificateTemplateResponse.model_validate(template)


@router.patch("/templates/{template_id}", response_model=CertificateTemplateResponse)
async def update_template(
    template_id: UUID,
    data: CertificateTemplateUpdate,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_compliance),
) -> CertificateTemplateResponse:
    """Update a template."""
    result = await db.execute(
        select(CertificateTemplate).where(CertificateTemplate.id == template_id)
    )
    template = result.scalar_one_or_none()
    if not template:
        raise NotFoundException("Template not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(template, key, value)

    await db.commit()
    await db.refresh(template)
    return CertificateTemplateResponse.model_validate(template)


@router.delete("/templates/{template_id}", status_code=204)
async def delete_template(
    template_id: UUID,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_compliance),
) -> None:
    """Delete a template."""
    result = await db.execute(
        select(CertificateTemplate).where(CertificateTemplate.id == template_id)
    )
    template = result.scalar_one_or_none()
    if not template:
        raise NotFoundException("Template not found")

    await db.delete(template)
    await db.commit()


# ============================================================================
# Certificate Preview
# ============================================================================

@router.post("/preview", response_model=CertificatePreviewResponse)
async def preview_certificate(
    data: CertificatePreviewRequest,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_internal),
) -> CertificatePreviewResponse:
    """Preview certificate content with auto-populated data."""
    # Get template content
    from app.services.certificate_service import DEFAULT_TEMPLATE
    template_content = DEFAULT_TEMPLATE
    if data.template_id:
        result = await db.execute(
            select(CertificateTemplate).where(CertificateTemplate.id == data.template_id)
        )
        template = result.scalar_one_or_none()
        if template:
            template_content = template.content

    # Get populated data
    populated_data: dict[str, Any] = {}
    if data.program_id:
        populated_data = await certificate_service.get_program_data_for_certificate(
            db, data.program_id
        )
    elif data.client_id:
        populated_data = await certificate_service.get_client_data_for_certificate(
            db, data.client_id
        )

    # Build render data
    title = data.title or f"{data.certificate_type.replace('_', ' ').title()} Certificate"
    render_data = {
        **populated_data,
        "certificate_number": "PREVIEW",
        "certificate_type": data.certificate_type,
        "title": title,
        "issue_date": None,
        "expiry_date": None,
        "issued_by": current_user.full_name,
    }

    # Render content
    content = data.custom_content or certificate_service.render_certificate_content(
        template_content, render_data
    )

    return CertificatePreviewResponse(
        title=title,
        content=content,
        populated_data=populated_data,
        available_placeholders=certificate_service.get_available_placeholders(
            data.certificate_type
        ),
    )


# ============================================================================
# Clearance Certificates
# ============================================================================

def build_certificate_response(
    cert: ClearanceCertificate,
    include_download_url: bool = False,
) -> dict[str, Any]:
    """Build certificate response with related data."""
    data = {
        "id": cert.id,
        "certificate_number": cert.certificate_number,
        "template_id": cert.template_id,
        "template_name": cert.template.name if cert.template else None,
        "program_id": cert.program_id,
        "program_title": cert.program.title if cert.program else None,
        "client_id": cert.client_id,
        "client_name": cert.client.name if cert.client else "",
        "title": cert.title,
        "content": cert.content,
        "populated_data": cert.populated_data,
        "certificate_type": cert.certificate_type,
        "status": cert.status,
        "issue_date": cert.issue_date,
        "expiry_date": cert.expiry_date,
        "reviewed_by": cert.reviewed_by,
        "reviewed_by_name": None,
        "reviewed_at": cert.reviewed_at,
        "review_notes": cert.review_notes,
        "pdf_path": cert.pdf_path,
        "download_url": None,
        "created_by": cert.created_by,
        "created_by_name": None,
        "created_at": cert.created_at,
        "updated_at": cert.updated_at,
    }

    if cert.creator:
        data["created_by_name"] = cert.creator.full_name

    if cert.reviewer:
        data["reviewed_by_name"] = cert.reviewer.full_name

    if include_download_url and cert.pdf_path:
        with contextlib.suppress(Exception):
            data["download_url"] = storage_service.get_presigned_url(cert.pdf_path)

    return data


@router.post("/", response_model=ClearanceCertificateResponse, status_code=201)
async def create_certificate(
    data: ClearanceCertificateCreate,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_compliance),
) -> ClearanceCertificateResponse:
    """Create a new clearance certificate."""
    # Verify client exists
    result = await db.execute(select(Client).where(Client.id == data.client_id))
    if not result.scalar_one_or_none():
        raise NotFoundException("Client not found")

    # Verify program if specified
    if data.program_id:
        result = await db.execute(select(Program).where(Program.id == data.program_id))
        if not result.scalar_one_or_none():
            raise NotFoundException("Program not found")

    certificate = await certificate_service.create_certificate(
        db,
        {
            "template_id": data.template_id,
            "program_id": data.program_id,
            "client_id": data.client_id,
            "title": data.title,
            "content": data.content,
            "certificate_type": data.certificate_type,
            "issue_date": data.issue_date,
            "expiry_date": data.expiry_date,
        },
        current_user,
    )

    # Reload with relationships
    result = await db.execute(
        select(ClearanceCertificate)
        .options(
            selectinload(ClearanceCertificate.client),
            selectinload(ClearanceCertificate.program),
            selectinload(ClearanceCertificate.template),
            selectinload(ClearanceCertificate.creator),
        )
        .where(ClearanceCertificate.id == certificate.id)
    )
    loaded_cert = cast(ClearanceCertificate, result.scalar_one())
    return ClearanceCertificateResponse.model_validate(build_certificate_response(loaded_cert))


@router.get("/", response_model=ClearanceCertificateListResponse)
async def list_certificates(
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_internal),
    client_id: UUID | None = None,
    program_id: UUID | None = None,
    status: str | None = None,
    certificate_type: str | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
) -> ClearanceCertificateListResponse:
    """List clearance certificates."""
    query = (
        select(ClearanceCertificate)
        .options(
            selectinload(ClearanceCertificate.client),
            selectinload(ClearanceCertificate.program),
            selectinload(ClearanceCertificate.template),
            selectinload(ClearanceCertificate.creator),
        )
    )

    if client_id:
        query = query.where(ClearanceCertificate.client_id == client_id)
    if program_id:
        query = query.where(ClearanceCertificate.program_id == program_id)
    if status:
        query = query.where(ClearanceCertificate.status == status)
    if certificate_type:
        query = query.where(ClearanceCertificate.certificate_type == certificate_type)

    query = query.order_by(ClearanceCertificate.created_at.desc())
    certificates, total = await paginate(db, query, skip=skip, limit=limit)

    return ClearanceCertificateListResponse(
        certificates=[
            ClearanceCertificateResponse.model_validate(build_certificate_response(c))
            for c in certificates
        ],
        total=total,
    )


@router.get("/{certificate_id}", response_model=ClearanceCertificateDetailResponse)
async def get_certificate(
    certificate_id: UUID,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_internal),
) -> ClearanceCertificateDetailResponse:
    """Get a specific certificate with history."""
    result = await db.execute(
        select(ClearanceCertificate)
        .options(
            selectinload(ClearanceCertificate.client),
            selectinload(ClearanceCertificate.program),
            selectinload(ClearanceCertificate.template),
            selectinload(ClearanceCertificate.creator),
            selectinload(ClearanceCertificate.reviewer),
            selectinload(ClearanceCertificate.history),
        )
        .where(ClearanceCertificate.id == certificate_id)
    )
    cert = result.scalar_one_or_none()
    if not cert:
        raise NotFoundException("Certificate not found")

    response_data = build_certificate_response(cert, include_download_url=True)
    response_data["history"] = [
        {
            "id": h.id,
            "certificate_id": h.certificate_id,
            "action": h.action,
            "from_status": h.from_status,
            "to_status": h.to_status,
            "actor_id": h.actor_id,
            "actor_name": h.actor_name,
            "notes": h.notes,
            "created_at": h.created_at,
        }
        for h in sorted(cert.history, key=lambda x: x.created_at, reverse=True)
    ]

    return ClearanceCertificateDetailResponse.model_validate(response_data)


@router.patch("/{certificate_id}", response_model=ClearanceCertificateResponse)
async def update_certificate(
    certificate_id: UUID,
    data: ClearanceCertificateUpdate,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_compliance),
) -> ClearanceCertificateResponse:
    """Update a draft certificate."""
    result = await db.execute(
        select(ClearanceCertificate)
        .options(
            selectinload(ClearanceCertificate.client),
            selectinload(ClearanceCertificate.program),
            selectinload(ClearanceCertificate.template),
            selectinload(ClearanceCertificate.creator),
        )
        .where(ClearanceCertificate.id == certificate_id)
    )
    cert = result.scalar_one_or_none()
    if not cert:
        raise NotFoundException("Certificate not found")

    if cert.status != "draft":
        raise BadRequestException("Only draft certificates can be updated")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(cert, key, value)

    # Create history entry
    history = ClearanceCertificateHistory(
        certificate_id=cert.id,
        action="updated",
        actor_id=current_user.id,
        actor_name=current_user.full_name,
    )
    db.add(history)
    await db.commit()
    await db.refresh(cert)

    return ClearanceCertificateResponse.model_validate(build_certificate_response(cert))


@router.post("/{certificate_id}/issue", response_model=ClearanceCertificateResponse)
async def issue_certificate(
    certificate_id: UUID,
    data: ClearanceCertificateIssue,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_compliance),
) -> ClearanceCertificateResponse:
    """Issue (finalize) a certificate."""
    try:
        cert = await certificate_service.issue_certificate(
            db,
            certificate_id,
            current_user,
            issue_date=data.issue_date,
            expiry_date=data.expiry_date,
            review_notes=data.review_notes,
        )
    except ValueError as e:
        raise BadRequestException(str(e)) from None

    # Reload with relationships
    result = await db.execute(
        select(ClearanceCertificate)
        .options(
            selectinload(ClearanceCertificate.client),
            selectinload(ClearanceCertificate.program),
            selectinload(ClearanceCertificate.template),
            selectinload(ClearanceCertificate.creator),
            selectinload(ClearanceCertificate.reviewer),
        )
        .where(ClearanceCertificate.id == cert.id)
    )
    cert = result.scalar_one()
    return ClearanceCertificateResponse.model_validate(
        build_certificate_response(cert, include_download_url=True)
    )


@router.post("/{certificate_id}/revoke", response_model=ClearanceCertificateResponse)
async def revoke_certificate(
    certificate_id: UUID,
    data: ClearanceCertificateRevoke,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_compliance),
) -> ClearanceCertificateResponse:
    """Revoke an issued certificate."""
    try:
        cert = await certificate_service.revoke_certificate(
            db, certificate_id, current_user, data.reason
        )
    except ValueError as e:
        raise BadRequestException(str(e)) from None

    # Reload with relationships
    result = await db.execute(
        select(ClearanceCertificate)
        .options(
            selectinload(ClearanceCertificate.client),
            selectinload(ClearanceCertificate.program),
            selectinload(ClearanceCertificate.template),
            selectinload(ClearanceCertificate.creator),
            selectinload(ClearanceCertificate.reviewer),
        )
        .where(ClearanceCertificate.id == cert.id)
    )
    cert = result.scalar_one()
    return ClearanceCertificateResponse.model_validate(build_certificate_response(cert))


@router.get("/{certificate_id}/download")
async def download_certificate(
    certificate_id: UUID,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_internal),
) -> dict[str, str]:
    """Get download URL for certificate PDF."""
    result = await db.execute(
        select(ClearanceCertificate).where(ClearanceCertificate.id == certificate_id)
    )
    cert = result.scalar_one_or_none()
    if not cert:
        raise NotFoundException("Certificate not found")

    if cert.status != "issued":
        raise BadRequestException("Certificate has not been issued")

    if not cert.pdf_path:
        raise NotFoundException("PDF not found")

    url = storage_service.get_presigned_url(cert.pdf_path)
    return {"download_url": url}


@router.get("/{certificate_id}/pdf", response_class=Response)
async def get_certificate_pdf(
    certificate_id: UUID,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_internal),
) -> Response:
    """Download certificate PDF directly."""
    result = await db.execute(
        select(ClearanceCertificate)
        .options(selectinload(ClearanceCertificate.creator))
        .where(ClearanceCertificate.id == certificate_id)
    )
    cert = result.scalar_one_or_none()
    if not cert:
        raise NotFoundException("Certificate not found")

    if cert.status != "issued":
        raise BadRequestException("Certificate has not been issued")

    # Generate PDF on-the-fly if not stored
    if not cert.pdf_path:
        pdf_bytes = await certificate_service.generate_certificate_pdf(
            cert,
            cert.creator.full_name if cert.creator else "AMG",
        )
    else:
        # Download from storage
        pdf_bytes = await storage_service.download_file(cert.pdf_path)

    filename = f"certificate_{cert.certificate_number}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.delete("/{certificate_id}", status_code=204)
async def delete_certificate(
    certificate_id: UUID,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_compliance),
) -> None:
    """Delete a draft certificate."""
    result = await db.execute(
        select(ClearanceCertificate).where(ClearanceCertificate.id == certificate_id)
    )
    cert = result.scalar_one_or_none()
    if not cert:
        raise NotFoundException("Certificate not found")

    if cert.status != "draft":
        raise BadRequestException("Only draft certificates can be deleted")

    # Delete PDF from storage if exists
    if cert.pdf_path:
        with contextlib.suppress(Exception):
            await storage_service.delete_file(cert.pdf_path)

    await db.delete(cert)
    await db.commit()
