"""Deliverable template endpoints.

Partner-facing:  browse templates, get download URL.
Internal staff:  create, upload file, update, delete.
"""

import contextlib
import logging
import uuid as _uuid
from datetime import timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile, status
from sqlalchemy import func, or_, select

from app.api.deps import (
    DB,
    CurrentUser,
    RLSContext,
    require_internal,
)
from app.core.exceptions import NotFoundException
from app.models.deliverable_template import DeliverableTemplate
from app.schemas.deliverable_template import (
    TEMPLATE_CATEGORIES,
    DeliverableTemplateListResponse,
    DeliverableTemplateResponse,
    DeliverableTemplateUpdate,
    TemplateCategoryInfo,
)
from app.services.storage import ALLOWED_MIME_TYPES, MAX_FILE_SIZE, storage_service

logger = logging.getLogger(__name__)

router = APIRouter()

_CATEGORY_LABELS: dict[str, str] = {
    "security_reports": "Security Reports",
    "travel_assessments": "Travel Assessments",
    "incident_reports": "Incident Reports",
    "financial_summaries": "Financial Summaries",
    "general": "General",
}


def _build_response(t: DeliverableTemplate) -> DeliverableTemplateResponse:
    download_url: str | None = None
    if t.file_path:
        with contextlib.suppress(Exception):
            download_url = storage_service.get_presigned_url(
                str(t.file_path), expires=timedelta(hours=1)
            )
    data = DeliverableTemplateResponse.model_validate(t)
    data.download_url = download_url
    return data


@router.get("/", response_model=DeliverableTemplateListResponse)
async def list_templates(
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    category: str | None = Query(None),
    deliverable_type: str | None = Query(None),
    search: str | None = Query(None, max_length=200),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
) -> DeliverableTemplateListResponse:
    """List active deliverable templates."""
    query = select(DeliverableTemplate).where(DeliverableTemplate.is_active.is_(True))

    if category:
        query = query.where(DeliverableTemplate.category == category)
    if deliverable_type:
        query = query.where(DeliverableTemplate.deliverable_type == deliverable_type)
    if search:
        like = f"%{search}%"
        query = query.where(
            or_(
                DeliverableTemplate.name.ilike(like),
                DeliverableTemplate.description.ilike(like),
            )
        )

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar_one()

    query = query.order_by(DeliverableTemplate.category, DeliverableTemplate.name)
    result = await db.execute(query.offset(skip).limit(limit))
    templates = list(result.scalars().all())

    return DeliverableTemplateListResponse(
        templates=[_build_response(t) for t in templates],
        total=total,
    )


@router.get("/categories", response_model=list[TemplateCategoryInfo])
async def list_categories(
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> list[TemplateCategoryInfo]:
    """Return template categories with counts."""
    count_q = (
        select(DeliverableTemplate.category, func.count().label("cnt"))
        .where(DeliverableTemplate.is_active.is_(True))
        .group_by(DeliverableTemplate.category)
    )
    rows = (await db.execute(count_q)).all()

    result: list[TemplateCategoryInfo] = []
    seen: set[str] = set()
    for row in rows:
        seen.add(row.category)
        result.append(
            TemplateCategoryInfo(
                key=row.category,
                label=_CATEGORY_LABELS.get(row.category, row.category.replace("_", " ").title()),
                count=row.cnt,
            )
        )
    for cat in TEMPLATE_CATEGORIES:
        if cat not in seen:
            result.append(
                TemplateCategoryInfo(
                    key=cat,
                    label=_CATEGORY_LABELS.get(cat, cat.replace("_", " ").title()),
                    count=0,
                )
            )
    return sorted(result, key=lambda c: c.key)


@router.get("/suggest", response_model=DeliverableTemplateListResponse)
async def suggest_templates(
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    deliverable_type: str | None = Query(None),
    assignment_title: str | None = Query(None, max_length=300),
    limit: int = Query(6, ge=1, le=20),
) -> DeliverableTemplateListResponse:
    """Return relevant templates for an assignment or deliverable type."""
    query = select(DeliverableTemplate).where(DeliverableTemplate.is_active.is_(True))

    filters = []
    if deliverable_type:
        filters.append(DeliverableTemplate.deliverable_type == deliverable_type)

    if assignment_title:
        keywords = _extract_keywords(assignment_title)
        if keywords:
            kw_filters = []
            for kw in keywords[:3]:
                like = f"%{kw}%"
                kw_filters.append(DeliverableTemplate.name.ilike(like))
                kw_filters.append(DeliverableTemplate.description.ilike(like))
            filters.append(or_(*kw_filters))

    if filters:
        query = query.where(or_(*filters))

    result = await db.execute(
        query.order_by(DeliverableTemplate.category, DeliverableTemplate.name).limit(limit)
    )
    templates = list(result.scalars().all())

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar_one()

    return DeliverableTemplateListResponse(
        templates=[_build_response(t) for t in templates],
        total=total,
    )


@router.get("/{template_id}/download-url")
async def get_template_download_url(
    template_id: UUID,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> dict[str, object]:
    """Return a short-lived presigned download URL for the template file."""
    result = await db.execute(
        select(DeliverableTemplate).where(
            DeliverableTemplate.id == template_id,
            DeliverableTemplate.is_active.is_(True),
        )
    )
    t = result.scalar_one_or_none()
    if not t:
        raise NotFoundException("Template not found")
    if not t.file_path:
        raise NotFoundException("Template has no file attached")

    try:
        url = storage_service.get_presigned_url(
            str(t.file_path), expires=timedelta(minutes=15)
        )
    except Exception as exc:
        logger.error(
            "Failed to generate presigned URL for template %s: %s", template_id, exc
        )
        raise NotFoundException("Could not generate download URL") from exc

    return {
        "template_id": str(template_id),
        "download_url": url,
        "file_name": t.file_name,
        "file_type": t.file_type,
    }


@router.get("/{template_id}", response_model=DeliverableTemplateResponse)
async def get_template(
    template_id: UUID,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> DeliverableTemplateResponse:
    result = await db.execute(
        select(DeliverableTemplate).where(
            DeliverableTemplate.id == template_id,
            DeliverableTemplate.is_active.is_(True),
        )
    )
    t = result.scalar_one_or_none()
    if not t:
        raise NotFoundException("Template not found")
    return _build_response(t)


@router.post("/", response_model=DeliverableTemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_template(
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    _: None = Depends(require_internal),
    name: str = Form(...),
    category: str = Form(...),
    description: str | None = Form(None),
    deliverable_type: str | None = Form(None),
    file: UploadFile | None = File(None),
) -> DeliverableTemplateResponse:
    """Create a new deliverable template. Optionally attach a file."""
    template = DeliverableTemplate(
        id=_uuid.uuid4(),
        name=name,
        description=description,
        category=category,
        deliverable_type=deliverable_type,
        created_by=current_user.id,
    )

    if file:
        await storage_service.validate_file(file, MAX_FILE_SIZE, ALLOWED_MIME_TYPES)
        original_name = file.filename
        original_type = file.content_type
        object_name, file_size = await storage_service.upload_file(
            file, f"deliverable-templates/{template.id}"
        )
        template.file_path = object_name  # type: ignore[assignment]
        template.file_name = original_name  # type: ignore[assignment]
        template.file_type = original_type  # type: ignore[assignment]
        template.file_size = file_size  # type: ignore[assignment]

    db.add(template)
    await db.commit()
    await db.refresh(template)
    return _build_response(template)


@router.patch("/{template_id}", response_model=DeliverableTemplateResponse)
async def update_template(
    template_id: UUID,
    payload: DeliverableTemplateUpdate,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    _: None = Depends(require_internal),
) -> DeliverableTemplateResponse:
    result = await db.execute(
        select(DeliverableTemplate).where(DeliverableTemplate.id == template_id)
    )
    t = result.scalar_one_or_none()
    if not t:
        raise NotFoundException("Template not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(t, field, value)

    await db.commit()
    await db.refresh(t)
    return _build_response(t)


@router.post("/{template_id}/file", response_model=DeliverableTemplateResponse)
async def upload_template_file(
    template_id: UUID,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    _: None = Depends(require_internal),
    file: UploadFile = File(...),
) -> DeliverableTemplateResponse:
    """Replace or attach a file for an existing template."""
    result = await db.execute(
        select(DeliverableTemplate).where(DeliverableTemplate.id == template_id)
    )
    t = result.scalar_one_or_none()
    if not t:
        raise NotFoundException("Template not found")

    await storage_service.validate_file(file, MAX_FILE_SIZE, ALLOWED_MIME_TYPES)
    original_name = file.filename
    original_type = file.content_type
    object_name, file_size = await storage_service.upload_file(
        file, f"deliverable-templates/{template_id}"
    )
    t.file_path = object_name  # type: ignore[assignment]
    t.file_name = original_name  # type: ignore[assignment]
    t.file_type = original_type  # type: ignore[assignment]
    t.file_size = file_size  # type: ignore[assignment]

    await db.commit()
    await db.refresh(t)
    return _build_response(t)


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(
    template_id: UUID,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    _: None = Depends(require_internal),
) -> None:
    result = await db.execute(
        select(DeliverableTemplate).where(DeliverableTemplate.id == template_id)
    )
    t = result.scalar_one_or_none()
    if not t:
        raise NotFoundException("Template not found")
    t.is_active = False  # type: ignore[assignment]
    await db.commit()


def _extract_keywords(text: str) -> list[str]:
    words = text.lower().split()
    found: list[str] = []
    for word in words:
        w = word.strip(".,;:!?\"'")
        if len(w) >= 4:
            found.append(w)
    return found[:10]
