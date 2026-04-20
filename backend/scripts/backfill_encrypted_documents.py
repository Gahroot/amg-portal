"""Phase 2.1 follow-up — backfill legacy plaintext documents.

Re-uploads every ``documents`` row with ``kek_version IS NULL`` through the
envelope-encryption pipeline (AES-256-GCM chunked, tenant-KEK-wrapped DEK),
overwrites the row's metadata to point at the new ciphertext object, and
deletes the original plaintext object from MinIO.

Idempotent: rows that are already encrypted (or already shredded) are skipped.
Run in batches so a transient failure doesn't corrupt the corpus.

Usage::

    cd backend
    python3 -m scripts.backfill_encrypted_documents

    # Dry run — no writes:
    python3 -m scripts.backfill_encrypted_documents --dry-run

    # Batch size (default 50):
    python3 -m scripts.backfill_encrypted_documents --batch 100

Production (Railway) — set ``DATABASE_URL`` to the public proxy host, e.g.::

    DATABASE_URL="postgresql+asyncpg://...maglev.proxy.rlwy.net.../railway" \
    python3 -m scripts.backfill_encrypted_documents
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.models.document import Document
from app.services.storage import storage_service

logger = logging.getLogger("backfill_encrypted_documents")


def _new_object_name(doc: Document) -> str:
    ext = ""
    if doc.file_name and "." in doc.file_name:
        ext = "." + doc.file_name.rsplit(".", 1)[1]
    return f"vault/{doc.entity_type}/{doc.entity_id}/{doc.id}{ext}.enc"


async def _process(doc: Document, *, dry_run: bool) -> str:  # noqa: PLR0911
    """Re-upload one document.  Returns a short status string for the log."""
    if doc.kek_version is not None:
        return "skip-already-encrypted"
    if doc.crypto_shredded:
        return "skip-shredded"
    if not doc.file_path:
        return "skip-missing-path"

    old_path = doc.file_path
    try:
        plaintext = await storage_service.download_file(old_path)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Download failed for %s (%s): %s", doc.id, old_path, exc)
        return "fail-download"

    subject_id: uuid.UUID = doc.subject_id or doc.entity_id
    new_path = _new_object_name(doc)

    if dry_run:
        return f"would-encrypt bytes={len(plaintext)} -> {new_path}"

    try:
        meta = await storage_service.upload_encrypted_bytes(
            new_path,
            plaintext,
            file_uuid=doc.id,
            subject_id=subject_id,
            content_type=doc.content_type,
            retention=None,  # Legacy rows keep any existing object-lock metadata.
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("Encrypt/upload failed for %s: %s", doc.id, exc)
        return "fail-upload"

    # Update the row atomically with the new pointer and envelope metadata.
    doc.file_path = new_path
    doc.file_size = len(plaintext)
    doc.kek_version = meta.kek_version
    doc.nonce_prefix = meta.nonce_prefix
    doc.sha256 = meta.sha256_plaintext
    doc.subject_id = subject_id

    # Best-effort delete of the old plaintext object.  Row changes commit
    # regardless so a half-finished run leaves the DB consistent with the
    # new ciphertext object; the orphan plaintext can be swept later.
    try:
        await storage_service.delete_file(old_path)
        deleted = True
    except Exception:  # noqa: BLE001
        logger.warning("Could not delete legacy plaintext object %s", old_path)
        deleted = False

    return f"ok bytes={len(plaintext)} path={new_path} legacy_deleted={deleted}"


async def run(*, batch: int, dry_run: bool) -> None:
    processed = 0
    ok = 0
    failed = 0
    while True:
        async with AsyncSessionLocal() as session:
            rows = (
                (
                    await session.execute(
                        select(Document)
                        .where(Document.kek_version.is_(None))
                        .where(Document.crypto_shredded.is_(False))
                        .order_by(Document.created_at)
                        .limit(batch)
                    )
                )
                .scalars()
                .all()
            )

            if not rows:
                break

            for doc in rows:
                status = await _process(doc, dry_run=dry_run)
                processed += 1
                if status.startswith("ok"):
                    ok += 1
                elif status.startswith("fail"):
                    failed += 1
                logger.info("doc=%s %s", doc.id, status)

            if not dry_run:
                await session.commit()

    logger.info(
        "backfill complete processed=%d ok=%d failed=%d dry_run=%s",
        processed,
        ok,
        failed,
        dry_run,
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--batch", type=int, default=50)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    asyncio.run(run(batch=args.batch, dry_run=args.dry_run))


if __name__ == "__main__":
    main()
