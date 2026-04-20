"""Per-conversation message-body encryption (Phase 2.7).

The DEK for a conversation is HKDF-derived from the tenant KEK:

    dek = HKDF(kek_v{N}, info=f"amg|conv|{conversation_id}|msg")

AAD for each message = ``conversation_id || sender_id || sequence``.  The
``sequence`` is the message's deterministic ``id`` — uuid4 is unique per
message, so reusing the DEK across messages is safe as long as the nonce
is fresh.

Wire format (stored in ``communications.body_ciphertext``):

    [1B version = 0x01][1B key_id][12B nonce][ct || 16B GCM tag]

Messaging is **server-side envelope encrypted with supervised break-glass** —
not true E2EE.  The backend has access to the KEK and therefore always
to the plaintext.  This is a product decision (see docs/security-plan.md D1).
"""

from __future__ import annotations

import os
from uuid import UUID

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.core.crypto import get_crypto

VERSION_BYTE = 0x01
NONCE_LEN = 12


def _aad(*, conversation_id: UUID, sender_id: UUID | None, message_id: UUID) -> bytes:
    sender = str(sender_id) if sender_id is not None else "anon"
    return f"amg-msg|{conversation_id}|{sender}|{message_id}".encode()


def _dek_for_conversation(conversation_id: UUID) -> tuple[bytes, int]:
    crypto = get_crypto()
    key_id = crypto.current_kek_id
    kek = crypto.unwrap_kek(key_id)
    dek = crypto.derive_dek(kek, conversation_id, "msg")
    return dek, key_id


def encrypt_body(
    plaintext: str,
    *,
    conversation_id: UUID,
    sender_id: UUID | None,
    message_id: UUID,
) -> tuple[bytes, int]:
    """Encrypt a message body.  Returns ``(ciphertext_blob, key_id)``."""
    dek, key_id = _dek_for_conversation(conversation_id)
    nonce = os.urandom(NONCE_LEN)
    ct_tag = AESGCM(dek).encrypt(
        nonce,
        plaintext.encode("utf-8"),
        _aad(
            conversation_id=conversation_id,
            sender_id=sender_id,
            message_id=message_id,
        ),
    )
    return bytes([VERSION_BYTE, key_id]) + nonce + ct_tag, key_id


def decrypt_body(
    blob: bytes,
    *,
    conversation_id: UUID,
    sender_id: UUID | None,
    message_id: UUID,
) -> str:
    if len(blob) < 2 + NONCE_LEN + 16:
        raise ValueError("Message ciphertext too short")
    version = blob[0]
    key_id = blob[1]
    if version != VERSION_BYTE:
        raise ValueError(f"Unsupported message envelope version 0x{version:02x}")
    crypto = get_crypto()
    kek = crypto.unwrap_kek(key_id)
    dek = crypto.derive_dek(kek, conversation_id, "msg")
    nonce = blob[2 : 2 + NONCE_LEN]
    ct_tag = blob[2 + NONCE_LEN :]
    plaintext = AESGCM(dek).decrypt(
        nonce,
        ct_tag,
        _aad(
            conversation_id=conversation_id,
            sender_id=sender_id,
            message_id=message_id,
        ),
    )
    return plaintext.decode("utf-8")
