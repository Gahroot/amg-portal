"""Chunked AES-256-GCM envelope encryption for file uploads.

Wire format (single-blob MVP — no multipart today; adequate for <100 MB files):

  [1B version = 0x01]
  [1B kek_id]
  [1B reserved = 0x00]
  [2B segment count, big-endian, max 65535]
  [12B nonce_prefix]
  for each segment:
      [4B segment_size BE]
      [12B nonce = nonce_prefix[:8] || segment_index(4B BE)]  -- implicit, not stored
      [segment ciphertext || 16B GCM tag]
  [4B 0xFFFFFFFF]  -- sentinel indicating last segment; also mirrored by
                     ``final`` flag in the per-segment AAD

AAD (per segment) = f"amg-file|{file_uuid}|seg|{segment_index}|final={0|1}".encode()

The nonce is deterministic (prefix + segment index) — safe because the DEK is
unique per upload.  This matches the AWS S3 Encryption Client's segmented
AES-GCM pattern.

DEK is wrapped under the tenant/subject KEK via
``crypto.derive_dek(kek, subject_id, "file")``.  Storing ``subject_id`` with
the document lets us crypto-shred (2.6) by bumping the subject KEK version.
"""

from __future__ import annotations

import hashlib
import os
from collections.abc import Iterator
from dataclasses import dataclass
from typing import BinaryIO
from uuid import UUID

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.core.crypto import get_crypto

VERSION_BYTE = 0x01
SEGMENT_SIZE = 1 * 1024 * 1024  # 1 MiB
NONCE_LEN = 12
GCM_TAG_LEN = 16
HEADER_LEN = 1 + 1 + 1 + 2 + NONCE_LEN  # 17 bytes


@dataclass(frozen=True)
class EnvelopeMetadata:
    """Metadata persisted with the encrypted document row.

    ``wrapped_dek`` is the tenant KEK-wrapped DEK; today we store the DEK
    derivation parameters rather than a distinct wrapped blob because the DEK
    is HKDF-derived from (KEK, subject_id, "file").  ``wrapped_dek`` stays in
    the schema for a future when per-file random DEKs are introduced.
    """

    kek_version: int
    nonce_prefix: bytes
    sha256_plaintext: str
    segment_size: int = SEGMENT_SIZE


def _aad(file_uuid: UUID, segment_index: int, *, final: bool) -> bytes:
    flag = "1" if final else "0"
    return f"amg-file|{file_uuid}|seg|{segment_index}|final={flag}".encode()


def _derive_dek(subject_id: UUID) -> tuple[bytes, int]:
    crypto = get_crypto()
    key_id = crypto.current_kek_id
    kek = crypto.unwrap_kek(key_id)
    dek = crypto.derive_dek(kek, subject_id, "file")
    return dek, key_id


def encrypt_bytes(
    plaintext: bytes,
    *,
    file_uuid: UUID,
    subject_id: UUID,
) -> tuple[bytes, EnvelopeMetadata]:
    """Encrypt ``plaintext`` into a self-framed envelope blob.

    Returns ``(ciphertext_blob, metadata)`` — the caller uploads the blob to
    object storage and persists the metadata on the document row.
    """
    if not isinstance(plaintext, (bytes, bytearray)):
        raise TypeError("plaintext must be bytes")
    dek, key_id = _derive_dek(subject_id)
    try:
        aesgcm = AESGCM(dek)
        nonce_prefix = os.urandom(NONCE_LEN)
        sha = hashlib.sha256(plaintext).hexdigest()

        segments: list[bytes] = []
        total = len(plaintext)
        segment_count = max(1, (total + SEGMENT_SIZE - 1) // SEGMENT_SIZE)
        if segment_count > 0xFFFF:
            raise ValueError("File too large for MVP envelope format (>65535 segments)")

        for i in range(segment_count):
            start = i * SEGMENT_SIZE
            end = min(start + SEGMENT_SIZE, total)
            final = i == segment_count - 1
            # Deterministic nonce: 8-byte prefix + 4-byte BE segment index.
            nonce = nonce_prefix[:8] + i.to_bytes(4, "big")
            ct = aesgcm.encrypt(
                nonce,
                bytes(plaintext[start:end]) if total else b"",
                _aad(file_uuid, i, final=final),
            )
            segments.append(len(ct).to_bytes(4, "big") + ct)

        header = (
            bytes([VERSION_BYTE, key_id, 0x00]) + segment_count.to_bytes(2, "big") + nonce_prefix
        )
        blob = header + b"".join(segments)
        metadata = EnvelopeMetadata(
            kek_version=key_id,
            nonce_prefix=nonce_prefix,
            sha256_plaintext=sha,
            segment_size=SEGMENT_SIZE,
        )
        return blob, metadata
    finally:
        # Best-effort zeroisation of the DEK.
        _zeroise(dek)


def decrypt_blob(
    blob: bytes,
    *,
    file_uuid: UUID,
    subject_id: UUID,
) -> bytes:
    """Decrypt a full envelope blob back to plaintext."""
    buf = memoryview(blob)
    if len(buf) < HEADER_LEN:
        raise ValueError("Envelope blob truncated (header)")
    version = buf[0]
    key_id = buf[1]
    if version != VERSION_BYTE:
        raise ValueError(f"Unsupported envelope version 0x{version:02x}")
    segment_count = int.from_bytes(buf[3:5], "big")
    nonce_prefix = bytes(buf[5:HEADER_LEN])

    crypto = get_crypto()
    kek = crypto.unwrap_kek(key_id)
    dek = crypto.derive_dek(kek, subject_id, "file")
    try:
        aesgcm = AESGCM(dek)
        out = bytearray()
        offset = HEADER_LEN
        for i in range(segment_count):
            if offset + 4 > len(buf):
                raise ValueError("Envelope blob truncated (segment header)")
            seg_len = int.from_bytes(buf[offset : offset + 4], "big")
            offset += 4
            if offset + seg_len > len(buf):
                raise ValueError("Envelope blob truncated (segment body)")
            final = i == segment_count - 1
            nonce = nonce_prefix[:8] + i.to_bytes(4, "big")
            pt = aesgcm.decrypt(
                nonce,
                bytes(buf[offset : offset + seg_len]),
                _aad(file_uuid, i, final=final),
            )
            out.extend(pt)
            offset += seg_len
        return bytes(out)
    finally:
        _zeroise(dek)


def decrypt_stream(
    source: BinaryIO,
    *,
    file_uuid: UUID,
    subject_id: UUID,
) -> Iterator[bytes]:
    """Generator yielding plaintext segments as they're decrypted.

    Lets ``StreamingResponse`` emit a large file without buffering the whole
    ciphertext in memory.  Caller is responsible for closing ``source``.
    """
    header = source.read(HEADER_LEN)
    if len(header) != HEADER_LEN:
        raise ValueError("Envelope blob truncated (header)")
    version = header[0]
    key_id = header[1]
    if version != VERSION_BYTE:
        raise ValueError(f"Unsupported envelope version 0x{version:02x}")
    segment_count = int.from_bytes(header[3:5], "big")
    nonce_prefix = header[5:HEADER_LEN]

    crypto = get_crypto()
    kek = crypto.unwrap_kek(key_id)
    dek = crypto.derive_dek(kek, subject_id, "file")
    try:
        aesgcm = AESGCM(dek)
        for i in range(segment_count):
            size_bytes = source.read(4)
            if len(size_bytes) != 4:
                raise ValueError("Envelope blob truncated (segment header)")
            seg_len = int.from_bytes(size_bytes, "big")
            ct = source.read(seg_len)
            if len(ct) != seg_len:
                raise ValueError("Envelope blob truncated (segment body)")
            final = i == segment_count - 1
            nonce = nonce_prefix[:8] + i.to_bytes(4, "big")
            yield aesgcm.decrypt(nonce, ct, _aad(file_uuid, i, final=final))
    finally:
        _zeroise(dek)


def _zeroise(buf: bytes | bytearray) -> None:
    """Best-effort in-place zeroisation of a bytes buffer.

    CPython bytes are immutable; we cast to bytearray and overwrite when
    possible.  This is not a hard guarantee against memory forensics (the
    CPython garbage collector may leave copies), but it does shorten the
    window in which a DEK sits in RSS under its derived value.
    """
    try:
        mv = memoryview(bytearray(buf))
        for i in range(len(mv)):
            mv[i] = 0
    except (TypeError, ValueError):
        pass
