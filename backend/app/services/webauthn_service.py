"""WebAuthn / FIDO2 service wrapper (Phase 2.9).

Thin adapter around ``py_webauthn`` 2.x.  Challenges are kept in Redis
keyed by ``user_id`` (registration) or ``session_id`` (authentication,
pre-auth flow).  The library handles attestation validation, origin +
RP-id enforcement, and sign-count checks.

TOTP remains the default second factor; passkeys are additive.  A user
may register zero or more credentials; authentication is "any passkey"
rather than "a specific device".
"""

from __future__ import annotations

import base64
import json
import logging
import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from webauthn import (
    generate_authentication_options,
    generate_registration_options,
    options_to_json,
    verify_authentication_response,
    verify_registration_response,
)
from webauthn.helpers.cose import COSEAlgorithmIdentifier
from webauthn.helpers.structs import (
    AuthenticatorSelectionCriteria,
    PublicKeyCredentialDescriptor,
    ResidentKeyRequirement,
    UserVerificationRequirement,
)

from app.core.config import settings
from app.core.exceptions import BadRequestException, NotFoundException
from app.db.redis import redis_client
from app.models.enums import AuditAction
from app.models.user import User
from app.models.webauthn_credential import WebAuthnCredential
from app.services.audit_service import log_action

logger = logging.getLogger(__name__)


def _challenge_key(ns: str, key: str) -> str:
    return f"webauthn:{ns}:{key}"


async def _store_challenge(ns: str, key: str, payload: dict[str, Any]) -> None:
    await redis_client.set(
        _challenge_key(ns, key),
        json.dumps(payload),
        ex=settings.WEBAUTHN_CHALLENGE_TTL_SECONDS,
    )


async def _pop_challenge(ns: str, key: str) -> dict[str, Any] | None:
    full = _challenge_key(ns, key)
    raw = await redis_client.get(full)
    if raw is None:
        return None
    await redis_client.delete(full)
    data: dict[str, Any] = json.loads(raw)
    return data


async def begin_registration(
    db: AsyncSession, user: User, *, nickname: str | None = None
) -> dict[str, Any]:
    """Emit the registration options JSON for the browser."""
    existing = (
        (await db.execute(select(WebAuthnCredential).where(WebAuthnCredential.user_id == user.id)))
        .scalars()
        .all()
    )
    exclude = [PublicKeyCredentialDescriptor(id=c.credential_id) for c in existing]
    options = generate_registration_options(
        rp_id=settings.WEBAUTHN_RP_ID,
        rp_name=settings.WEBAUTHN_RP_NAME,
        user_id=str(user.id).encode("utf-8"),
        user_name=user.email,
        user_display_name=user.full_name or user.email,
        exclude_credentials=exclude,
        supported_pub_key_algs=[
            COSEAlgorithmIdentifier.ECDSA_SHA_256,
            COSEAlgorithmIdentifier.RSASSA_PKCS1_v1_5_SHA_256,
        ],
        authenticator_selection=AuthenticatorSelectionCriteria(
            resident_key=ResidentKeyRequirement.PREFERRED,
            user_verification=UserVerificationRequirement.REQUIRED,
        ),
    )
    challenge_b64 = base64.urlsafe_b64encode(options.challenge).decode("ascii")
    await _store_challenge(
        "reg",
        str(user.id),
        {"challenge": challenge_b64, "nickname": nickname},
    )
    options_dict: dict[str, Any] = json.loads(options_to_json(options))
    return options_dict


async def complete_registration(
    db: AsyncSession, user: User, client_response: dict[str, Any]
) -> WebAuthnCredential:
    """Verify the attestation + persist the credential row."""
    stored = await _pop_challenge("reg", str(user.id))
    if stored is None:
        raise BadRequestException("No registration challenge in progress")
    challenge = base64.urlsafe_b64decode(stored["challenge"])

    verified = verify_registration_response(
        credential=client_response,
        expected_challenge=challenge,
        expected_rp_id=settings.WEBAUTHN_RP_ID,
        expected_origin=settings.WEBAUTHN_ORIGINS,
        require_user_verification=True,
    )

    transports: list[str] = []
    raw_transports = client_response.get("response", {}).get("transports") or []
    if isinstance(raw_transports, list):
        transports = [str(t)[:32] for t in raw_transports]

    cred = WebAuthnCredential(
        user_id=user.id,
        credential_id=verified.credential_id,
        public_key=verified.credential_public_key,
        sign_count=verified.sign_count,
        transports=",".join(transports) if transports else None,
        aaguid=str(getattr(verified, "aaguid", "")) or None,
        nickname=stored.get("nickname") or None,
        backup_state=bool(getattr(verified, "credential_backed_up", False)),
    )
    db.add(cred)
    await db.flush()
    await log_action(
        db,
        action=AuditAction.webauthn_registered,
        entity_type="webauthn_credentials",
        entity_id=str(cred.id),
        user=user,
        after_state={
            "nickname": cred.nickname,
            "aaguid": cred.aaguid,
            "transports": cred.transports,
        },
    )
    return cred


async def begin_authentication(db: AsyncSession, user: User) -> dict[str, Any]:
    creds = (
        (await db.execute(select(WebAuthnCredential).where(WebAuthnCredential.user_id == user.id)))
        .scalars()
        .all()
    )
    if not creds:
        raise NotFoundException("No passkeys registered for this user")

    options = generate_authentication_options(
        rp_id=settings.WEBAUTHN_RP_ID,
        allow_credentials=[PublicKeyCredentialDescriptor(id=c.credential_id) for c in creds],
        user_verification=UserVerificationRequirement.REQUIRED,
    )
    challenge_b64 = base64.urlsafe_b64encode(options.challenge).decode("ascii")
    await _store_challenge("auth", str(user.id), {"challenge": challenge_b64})
    options_dict: dict[str, Any] = json.loads(options_to_json(options))
    return options_dict


async def complete_authentication(
    db: AsyncSession, user: User, client_response: dict[str, Any]
) -> WebAuthnCredential:
    stored = await _pop_challenge("auth", str(user.id))
    if stored is None:
        raise BadRequestException("No authentication challenge in progress")
    challenge = base64.urlsafe_b64decode(stored["challenge"])

    credential_id_b64 = client_response.get("id") or client_response.get("rawId")
    if not credential_id_b64:
        raise BadRequestException("credential id missing from response")
    # py_webauthn accepts url-safe b64 or raw bytes; support both.
    try:
        credential_id = base64.urlsafe_b64decode(
            credential_id_b64 + "=" * (-len(credential_id_b64) % 4)
        )
    except (ValueError, TypeError) as exc:
        raise BadRequestException("malformed credential id") from exc

    cred = (
        await db.execute(
            select(WebAuthnCredential).where(
                WebAuthnCredential.user_id == user.id,
                WebAuthnCredential.credential_id == credential_id,
            )
        )
    ).scalar_one_or_none()
    if cred is None:
        raise NotFoundException("Credential not registered")

    verified = verify_authentication_response(
        credential=client_response,
        expected_challenge=challenge,
        expected_rp_id=settings.WEBAUTHN_RP_ID,
        expected_origin=settings.WEBAUTHN_ORIGINS,
        credential_public_key=cred.public_key,
        credential_current_sign_count=cred.sign_count,
        require_user_verification=True,
    )
    cred.sign_count = verified.new_sign_count
    cred.last_used_at = datetime.now(UTC)
    await db.flush()
    return cred


async def list_credentials(db: AsyncSession, user: User) -> list[WebAuthnCredential]:
    rows = (
        (
            await db.execute(
                select(WebAuthnCredential)
                .where(WebAuthnCredential.user_id == user.id)
                .order_by(WebAuthnCredential.created_at.desc())
            )
        )
        .scalars()
        .all()
    )
    return list(rows)


async def delete_credential(db: AsyncSession, user: User, credential_id: uuid.UUID) -> None:
    cred = (
        await db.execute(
            select(WebAuthnCredential).where(
                WebAuthnCredential.id == credential_id,
                WebAuthnCredential.user_id == user.id,
            )
        )
    ).scalar_one_or_none()
    if cred is None:
        raise NotFoundException("Credential not found")
    await db.delete(cred)
    await log_action(
        db,
        action=AuditAction.webauthn_removed,
        entity_type="webauthn_credentials",
        entity_id=str(credential_id),
        user=user,
    )
