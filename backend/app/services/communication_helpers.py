"""Shared helpers for communication service modules."""

import contextlib
import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.communication import Communication
from app.services.message_crypto import decrypt_body

logger = logging.getLogger(__name__)


def _attach_plaintext_body(db: AsyncSession, msg: Communication) -> None:
    """Decrypt ``body_ciphertext`` into ``msg.body`` for response serialisation.

    Legacy rows (``body_ciphertext is None``) are left untouched — their
    plaintext still lives in ``body``.  For encrypted rows the mutation is
    applied after detaching from the session so the transient plaintext
    can never flush back to the database.
    """
    if msg.body_ciphertext is None:
        return
    # Detach BEFORE mutating so the plaintext assignment is not tracked.
    # Safe to suppress: already-detached or never-attached is the no-op case.
    with contextlib.suppress(Exception):
        db.expunge(msg)
    try:
        msg.body = decrypt_body(
            msg.body_ciphertext,
            conversation_id=msg.conversation_id,  # type: ignore[arg-type]
            sender_id=msg.sender_id,
            message_id=msg.id,
        )
    except Exception:
        logger.exception("Failed to decrypt message body for %s", msg.id)
        msg.body = ""
