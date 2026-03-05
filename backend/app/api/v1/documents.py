"""Document management endpoints."""

import contextlib
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy import func, select

from app.api.deps import DB, CurrentUser, require_coordinator_or_above, require_internal
from app.models.document import Document
from app.schemas.document import DocumentListResponse, DocumentResponse
from app.services.storage import storage_service

router = APIRouter()


def build_document_response(doc: Document) -> DocumentResponse:
    data: dict[str, object] = {
        "id": doc.id,
        "file_path": doc.file_path,
        "file_name": doc.file_name,
        "file_size": doc.file_size,
        "content_type": doc.content_type,
        "entity_type": doc.entity_type,
        "entity_id": doc.entity_id,
        "category": doc.category,
        "description": doc.description,
        "version": doc.version,
        "uploaded_by": doc.uploaded_by,
        "created_at": doc.created_at,
        "updated_at": doc.updated_at,
        "download_url": None,
    }
    if doc.file_path:
        with contextlib.suppress(Exception):
            data["download_url"] = storage_service.get_presigned_url(str(doc.file_path))
    return DocumentResponse.model_validate(data)


@router.post("/", response_model=DocumentResponse, status_code=201)
async def upload_document(
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_internal),
    file: UploadFile = File(...),
    entity_type: str = Form(...),
    entity_id: UUID = Form(...),
    category: str = Form("general"),
    description: str | None = Form(None),
) -> DocumentResponse:
    await storage_service.validate_file(file)

    object_path, file_size = await storage_service.upload_file_scoped(
        file,
        entity_type,
        str(entity_id),
    )

    doc = Document(
        file_path=object_path,
        file_name=file.filename or "untitled",
        file_size=file_size,
        content_type=file.content_type,
        entity_type=entity_type,
        entity_id=entity_id,
        category=category,
        description=description,
        uploaded_by=current_user.id,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)
    return build_document_response(doc)


@router.get("/", response_model=DocumentListResponse)
async def list_documents(
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_internal),
    entity_type: str | None = None,
    entity_id: UUID | None = None,
    category: str | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
) -> DocumentListResponse:
    query = select(Document)
    count_query = select(func.count()).select_from(Document)

    filters = []
    if entity_type:
        filters.append(Document.entity_type == entity_type)
    if entity_id:
        filters.append(Document.entity_id == entity_id)
    if category:
        filters.append(Document.category == category)

    for f in filters:
        query = query.where(f)
        count_query = count_query.where(f)

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.offset(skip).limit(limit).order_by(Document.created_at.desc())
    result = await db.execute(query)
    documents = result.scalars().all()

    return DocumentListResponse(
        documents=[build_document_response(d) for d in documents],
        total=total,
    )


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: UUID,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_internal),
) -> DocumentResponse:
    result = await db.execute(select(Document).where(Document.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return build_document_response(doc)


@router.get("/{document_id}/download")
async def download_document(
    document_id: UUID,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_internal),
) -> dict[str, str]:
    result = await db.execute(select(Document).where(Document.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    url = storage_service.get_presigned_url(str(doc.file_path))
    return {"download_url": url}


@router.delete("/{document_id}", status_code=204)
async def delete_document(
    document_id: UUID,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_coordinator_or_above),
) -> None:
    result = await db.execute(select(Document).where(Document.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    with contextlib.suppress(Exception):
        storage_service.delete_file(str(doc.file_path))

    await db.delete(doc)
    await db.commit()
