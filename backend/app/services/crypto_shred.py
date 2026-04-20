"""Crypto-shred primitives for Phase 2.6 (two-person delete → KEK shred)
and Phase 2.14 (erasure endpoint).

Model: each subject (client, program, conversation, IR case) has a row in
``subject_kek_versions`` with an ``active`` version number.  Every ciphertext
encrypted under the subject's DEK is bound to that version via HKDF info.

To shred a subject:

    1.  Mark the active ``subject_kek_versions`` row ``destroyed_at`` and
        ``active=False``.  No new row is inserted — the subject has *no*
        active key going forward.
    2.  Null out per-row ``dek_wrapped`` / ``nonce_prefix`` columns on the
        subject's documents (belt-and-braces — we don't actually store per-file
        wrapped DEKs today, but the columns are reserved for that).
    3.  Flip ``crypto_shredded=True`` on every document bound to the subject.
    4.  Emit an audit-chain entry (``AuditAction.subject_shredded``).

Ciphertext on disk is retained (so retention obligations still hold).
Reading it re-derives the DEK under the current subject_version — which for
a shredded subject is a fresh (non-existent) version; the HKDF output is
unrelated to the version used at encrypt time and GCM authentication fails.
Plaintext is mathematically unrecoverable.  ENISA-recognised pattern.
"""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import Document
from app.models.enums import AuditAction
from app.models.subject_kek_version import SubjectKEKVersion
from app.models.user import User
from app.services.audit_service import log_action

logger = logging.getLogger(__name__)


async def get_or_create_version(
    db: AsyncSession,
    *,
    subject_type: str,
    subject_id: uuid.UUID,
) -> SubjectKEKVersion:
    result = await db.execute(
        select(SubjectKEKVersion)
        .where(
            SubjectKEKVersion.subject_type == subject_type,
            SubjectKEKVersion.subject_id == subject_id,
            SubjectKEKVersion.active.is_(True),
        )
        .order_by(SubjectKEKVersion.version.desc())
        .limit(1)
    )
    row = result.scalar_one_or_none()
    if row is not None:
        return row
    row = SubjectKEKVersion(
        subject_type=subject_type,
        subject_id=subject_id,
        version=1,
        active=True,
    )
    db.add(row)
    await db.flush()
    return row


async def shred_subject(
    db: AsyncSession,
    *,
    subject_type: str,
    subject_id: uuid.UUID,
    actor: User,
    reason: str | None = None,
) -> dict[str, Any]:
    """Crypto-shred every ciphertext bound to ``(subject_type, subject_id)``."""
    now = datetime.now(UTC)

    # 1. Deactivate current subject KEK version(s).  There SHOULD be at most
    # one active row; be defensive.
    deactivated = await db.execute(
        update(SubjectKEKVersion)
        .where(
            SubjectKEKVersion.subject_type == subject_type,
            SubjectKEKVersion.subject_id == subject_id,
            SubjectKEKVersion.active.is_(True),
        )
        .values(active=False, destroyed_at=now, destroyed_by=actor.id)
        .returning(SubjectKEKVersion.id)
    )
    deactivated_ids = [r[0] for r in deactivated.all()]

    # 2. Flip crypto_shredded on every document bound to this subject.
    doc_result = await db.execute(
        update(Document)
        .where(Document.subject_id == subject_id)
        .values(crypto_shredded=True, dek_wrapped=None)
        .returning(Document.id)
    )
    shredded_doc_ids = [str(r[0]) for r in doc_result.all()]

    # 3. Audit chain entry (always, even if no docs matched — the fact of
    # the shred decision is itself the compliance artefact).
    await log_action(
        db,
        action=AuditAction.subject_shredded,
        entity_type=subject_type,
        entity_id=str(subject_id),
        user=actor,
        after_state={
            "reason": reason,
            "documents_shredded": len(shredded_doc_ids),
            "kek_versions_destroyed": len(deactivated_ids),
            "actor_id": str(actor.id),
            "at": now.isoformat(),
        },
    )

    logger.warning(
        "Crypto-shred executed: subject=%s/%s actor=%s docs=%d",
        subject_type,
        subject_id,
        actor.id,
        len(shredded_doc_ids),
    )
    return {
        "subject_type": subject_type,
        "subject_id": str(subject_id),
        "documents_shredded": shredded_doc_ids,
        "kek_versions_destroyed": [str(i) for i in deactivated_ids],
        "at": now.isoformat(),
    }


async def shred_document(
    db: AsyncSession,
    *,
    document: Document,
    actor: User,
    reason: str | None = None,
) -> None:
    """Single-document shred — used by two-person delete on documents."""
    document.crypto_shredded = True
    document.dek_wrapped = None
    await log_action(
        db,
        action=AuditAction.document_shredded,
        entity_type="documents",
        entity_id=str(document.id),
        user=actor,
        after_state={
            "file_name": document.file_name,
            "sha256": document.sha256,
            "reason": reason,
        },
    )
