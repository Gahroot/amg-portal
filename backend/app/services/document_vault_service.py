"""Document vault and delivery service."""

import secrets
from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import UploadFile
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import Document
from app.models.document_delivery import DocumentDelivery
from app.services.storage import storage_service


async def deliver_document(
    db: AsyncSession,
    document_id: UUID,
    recipient_ids: list[UUID],
    method: str = "portal",
    notes: str | None = None,
    delivered_by: UUID | None = None,
) -> list[DocumentDelivery]:
    """Create delivery records for a document to multiple recipients."""
    result = await db.execute(select(Document).where(Document.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise ValueError("Document not found")

    deliveries: list[DocumentDelivery] = []
    now = datetime.now(UTC)

    for recipient_id in recipient_ids:
        delivery = DocumentDelivery(
            document_id=document_id,
            recipient_id=recipient_id,
            delivery_method=method,
            delivered_at=now,
            notes=notes,
        )
        db.add(delivery)
        deliveries.append(delivery)

    # Update chain of custody
    custody: list[dict[str, object]] = list(doc.chain_of_custody or [])
    custody.append(
        {
            "action": "delivered",
            "user_id": str(delivered_by) if delivered_by else "system",
            "timestamp": now.isoformat(),
            "details": f"Delivered via {method} to {len(recipient_ids)} recipient(s)",
        }
    )
    doc.chain_of_custody = custody

    await db.commit()
    for d in deliveries:
        await db.refresh(d)
    return deliveries


async def generate_secure_link(
    db: AsyncSession,
    document_id: UUID,
    recipient_id: UUID,
    expires_hours: int = 24,
    issued_by: UUID | None = None,
) -> DocumentDelivery:
    """Create a time-limited secure download link for a document."""
    result = await db.execute(select(Document).where(Document.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise ValueError("Document not found")

    token = secrets.token_urlsafe(48)
    now = datetime.now(UTC)
    expires_at = now + timedelta(hours=expires_hours)

    delivery = DocumentDelivery(
        document_id=document_id,
        recipient_id=recipient_id,
        delivery_method="secure_link",
        delivered_at=now,
        secure_link_token=token,
        secure_link_expires_at=expires_at,
    )
    db.add(delivery)

    # Update chain of custody
    custody: list[dict[str, object]] = list(doc.chain_of_custody or [])
    custody.append(
        {
            "action": "secure_link_generated",
            "user_id": str(issued_by) if issued_by else "system",
            "timestamp": now.isoformat(),
            "details": (
                f"Secure link generated for recipient {recipient_id},"
                f" expires {expires_at.isoformat()}"
            ),
        }
    )
    doc.chain_of_custody = custody

    await db.commit()
    await db.refresh(delivery)
    return delivery


async def seal_document(
    db: AsyncSession,
    document_id: UUID,
    user_id: UUID,
    retention_policy: str | None = None,
) -> Document:
    """Seal a document making it immutable for compliance."""
    result = await db.execute(select(Document).where(Document.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise ValueError("Document not found")

    if doc.vault_status == "sealed":
        raise ValueError("Document is already sealed")

    now = datetime.now(UTC)
    doc.vault_status = "sealed"  # type: ignore[assignment]
    doc.sealed_at = now
    doc.sealed_by = user_id
    if retention_policy:
        doc.retention_policy = retention_policy

    # Update chain of custody
    custody: list[dict[str, object]] = list(doc.chain_of_custody or [])
    custody.append(
        {
            "action": "sealed",
            "user_id": str(user_id),
            "timestamp": now.isoformat(),
            "details": f"Document sealed for compliance. Retention: {retention_policy or 'not set'}",  # noqa: E501
        }
    )
    doc.chain_of_custody = custody

    await db.commit()
    await db.refresh(doc)
    return doc


async def get_chain_of_custody(
    db: AsyncSession,
    document_id: UUID,
) -> dict[str, object]:
    """Return the full audit trail for a document."""
    result = await db.execute(select(Document).where(Document.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise ValueError("Document not found")

    entries: list[dict[str, object]] = list(doc.chain_of_custody or [])
    return {
        "document_id": doc.id,
        "file_name": doc.file_name,
        "vault_status": doc.vault_status,
        "entries": entries,
        "total": len(entries),
    }


async def verify_document_integrity(
    db: AsyncSession,
    document_id: UUID,
) -> dict[str, object]:
    """Check document integrity — verify it exists in storage and is consistent."""
    result = await db.execute(select(Document).where(Document.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise ValueError("Document not found")

    integrity_ok = True
    issues: list[str] = []

    # Check if file exists in storage by trying to get a presigned URL
    try:
        storage_service.get_presigned_url(str(doc.file_path))
    except Exception:
        integrity_ok = False
        issues.append("File not found in storage")

    # Check if sealed document has proper metadata
    if doc.vault_status == "sealed":
        if not doc.sealed_at:
            integrity_ok = False
            issues.append("Sealed document missing sealed_at timestamp")
        if not doc.sealed_by:
            integrity_ok = False
            issues.append("Sealed document missing sealed_by user")

    return {
        "document_id": doc.id,
        "file_name": doc.file_name,
        "vault_status": doc.vault_status,
        "integrity_ok": integrity_ok,
        "issues": issues,
        "checked_at": datetime.now(UTC).isoformat(),
    }


async def bulk_upload_documents(
    db: AsyncSession,
    files: list[UploadFile],
    entity_type: str,
    entity_id: UUID,
    category: str,
    description: str | None,
    uploaded_by: UUID,
) -> list[Document]:
    """Validate and upload multiple files, returning all created Document records."""
    docs: list[Document] = []
    for file in files:
        await storage_service.validate_file(file)
        file_name = file.filename or "untitled"

        existing = await db.execute(
            select(func.max(Document.version)).where(
                Document.entity_type == entity_type,
                Document.entity_id == entity_id,
                Document.file_name == file_name,
            )
        )
        next_version = (existing.scalar() or 0) + 1

        object_path, file_size = await storage_service.upload_file_scoped(
            file, entity_type, str(entity_id)
        )
        doc = Document(
            file_path=object_path,
            file_name=file_name,
            file_size=file_size,
            content_type=file.content_type,
            entity_type=entity_type,
            entity_id=entity_id,
            category=category,
            description=description,
            version=next_version,
            uploaded_by=uploaded_by,
        )
        db.add(doc)
        docs.append(doc)

    await db.commit()
    for doc in docs:
        await db.refresh(doc)
    return docs


async def get_vault_documents(
    db: AsyncSession,
    vault_status: str | None = None,
    skip: int = 0,
    limit: int = 50,
) -> tuple[list[Document], int]:
    """List documents in the evidence vault, optionally filtered by status."""
    filters = []
    if vault_status:
        filters.append(Document.vault_status == vault_status)
    else:
        # By default show sealed and archived (not plain active)
        filters.append(Document.vault_status.in_(["sealed", "archived"]))

    count_query = select(func.count()).select_from(Document).where(*filters)
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = (
        select(Document)
        .where(*filters)
        .order_by(Document.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(query)
    docs = list(result.scalars().all())
    return docs, total


async def get_document_deliveries(
    db: AsyncSession,
    document_id: UUID,
    skip: int = 0,
    limit: int = 50,
) -> tuple[list[DocumentDelivery], int]:
    """Get delivery records for a document."""
    count_query = (
        select(func.count())
        .select_from(DocumentDelivery)
        .where(DocumentDelivery.document_id == document_id)
    )
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = (
        select(DocumentDelivery)
        .where(DocumentDelivery.document_id == document_id)
        .order_by(DocumentDelivery.delivered_at.desc())
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(query)
    deliveries = list(result.scalars().all())
    return deliveries, total


async def resolve_secure_link(
    db: AsyncSession,
    token: str,
) -> tuple[Document, DocumentDelivery]:
    """Resolve a secure link token to document + delivery, mark as viewed."""
    result = await db.execute(
        select(DocumentDelivery).where(DocumentDelivery.secure_link_token == token)
    )
    delivery = result.scalar_one_or_none()
    if not delivery:
        raise ValueError("Invalid or expired secure link")

    now = datetime.now(UTC)
    if delivery.secure_link_expires_at and delivery.secure_link_expires_at < now:
        raise ValueError("Secure link has expired")

    # Get the document
    doc_result = await db.execute(select(Document).where(Document.id == delivery.document_id))
    doc = doc_result.scalar_one_or_none()
    if not doc:
        raise ValueError("Document not found")

    # Mark as viewed
    if not delivery.viewed_at:
        delivery.viewed_at = now
        # Update custody chain
        custody: list[dict[str, object]] = list(doc.chain_of_custody or [])
        custody.append(
            {
                "action": "viewed_via_secure_link",
                "user_id": str(delivery.recipient_id),
                "timestamp": now.isoformat(),
                "details": "Document viewed via secure link",
            }
        )
        doc.chain_of_custody = custody
        await db.commit()
        await db.refresh(delivery)
        await db.refresh(doc)

    return doc, delivery
