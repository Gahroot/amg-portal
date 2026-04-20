import hashlib
import uuid as uuid_mod
from datetime import UTC, datetime, timedelta
from typing import Any

import bcrypt
import jwt
import jwt.exceptions
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings

# Valid JWT algorithms - explicitly whitelist to prevent algorithm confusion attacks
VALID_JWT_ALGORITHMS = {"HS256", "HS384", "HS512"}


def _validate_algorithm() -> str:
    """Validate and return the JWT algorithm, ensuring it's in our whitelist."""
    algo = settings.ALGORITHM
    if algo not in VALID_JWT_ALGORITHMS:
        raise ValueError(f"Invalid JWT algorithm: {algo}. Must be one of {VALID_JWT_ALGORITHMS}")
    return algo


def create_access_token(data: dict[str, Any]) -> str:
    to_encode = data.copy()
    expire = datetime.now(UTC) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "type": "access"})
    algorithm = _validate_algorithm()
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=algorithm)


def create_refresh_token(
    data: dict[str, Any],
    *,
    family: str | None = None,
    jti: str | None = None,
) -> str:
    to_encode = data.copy()
    expire = datetime.now(UTC) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    token_jti = jti or str(uuid_mod.uuid4())
    token_family = family or str(uuid_mod.uuid4())
    to_encode.update(
        {
            "exp": expire,
            "type": "refresh",
            "jti": token_jti,
            "family": token_family,
        }
    )
    algorithm = _validate_algorithm()
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=algorithm)


def hash_token(token: str) -> str:
    """SHA-256 hash of a token for safe database storage."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def decode_access_token(token: str) -> dict[str, Any] | None:
    try:
        algorithm = _validate_algorithm()
        payload: dict[str, Any] = jwt.decode(token, settings.SECRET_KEY, algorithms=[algorithm])
        if payload.get("type") != "access":
            return None
        return payload
    except jwt.exceptions.InvalidTokenError:
        return None


def create_mfa_setup_token(data: dict[str, Any]) -> str:
    """Create a short-lived token scoped only for completing MFA setup."""
    to_encode = data.copy()
    expire = datetime.now(UTC) + timedelta(minutes=settings.MFA_SETUP_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "type": "mfa_setup"})
    algorithm = _validate_algorithm()
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=algorithm)


def decode_mfa_setup_token(token: str) -> dict[str, Any] | None:
    """Decode and validate an MFA setup token."""
    try:
        algorithm = _validate_algorithm()
        payload: dict[str, Any] = jwt.decode(token, settings.SECRET_KEY, algorithms=[algorithm])
        if payload.get("type") != "mfa_setup":
            return None
        return payload
    except jwt.exceptions.InvalidTokenError:
        return None


# ── Step-up auth (Phase 2.10) ───────────────────────────────
# Short-lived tokens bound to a list of sensitive actions.  Obtained by
# re-authenticating via TOTP, passkey, or break-glass approval; consumed
# by the ``require_step_up`` dependency (Phase 2.11).


def create_step_up_token(
    data: dict[str, Any],
    *,
    action_scope: list[str],
    ttl_minutes: int | None = None,
) -> str:
    """Create a short-lived JWT authorising a specific sensitive action.

    ``action_scope`` is a list of action identifiers (e.g. ``["view_pii"]``,
    ``["wire_approve"]``).  ``require_step_up(action=...)`` dependencies
    verify the requested action is in the token's scope.
    """
    to_encode = data.copy()
    minutes = ttl_minutes if ttl_minutes is not None else settings.STEP_UP_TOKEN_EXPIRE_MINUTES
    expire = datetime.now(UTC) + timedelta(minutes=minutes)
    to_encode.update(
        {
            "exp": expire,
            "type": "step_up",
            "action_scope": list(action_scope),
        }
    )
    algorithm = _validate_algorithm()
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=algorithm)


def decode_step_up_token(token: str) -> dict[str, Any] | None:
    """Decode a step-up JWT; return the payload iff type=='step_up' and valid."""
    try:
        algorithm = _validate_algorithm()
        payload: dict[str, Any] = jwt.decode(token, settings.SECRET_KEY, algorithms=[algorithm])
        if payload.get("type") != "step_up":
            return None
        return payload
    except jwt.exceptions.InvalidTokenError:
        return None


# ── Break-glass scoped tokens (Phase 2.8) ───────────────────
# Issued after a compliance break-glass approval, binds a user to a
# specific conversation/document for decryption-audit purposes.


def create_break_glass_token(
    data: dict[str, Any],
    *,
    action_scope: list[str],
    resource_ids: list[str],
    justification: str,
    ttl_minutes: int | None = None,
) -> str:
    to_encode = data.copy()
    minutes = (
        ttl_minutes
        if ttl_minutes is not None
        else settings.BREAK_GLASS_TOKEN_EXPIRE_MINUTES
    )
    expire = datetime.now(UTC) + timedelta(minutes=minutes)
    to_encode.update(
        {
            "exp": expire,
            "type": "break_glass",
            "action_scope": list(action_scope),
            "resource_ids": list(resource_ids),
            "justification": justification,
        }
    )
    algorithm = _validate_algorithm()
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=algorithm)


def decode_break_glass_token(token: str) -> dict[str, Any] | None:
    try:
        algorithm = _validate_algorithm()
        payload: dict[str, Any] = jwt.decode(token, settings.SECRET_KEY, algorithms=[algorithm])
        if payload.get("type") != "break_glass":
            return None
        return payload
    except jwt.exceptions.InvalidTokenError:
        return None


def decode_refresh_token(token: str) -> dict[str, Any] | None:
    try:
        algorithm = _validate_algorithm()
        payload: dict[str, Any] = jwt.decode(token, settings.SECRET_KEY, algorithms=[algorithm])
        if payload.get("type") != "refresh":
            return None
        return payload
    except jwt.exceptions.InvalidTokenError:
        return None


def create_password_reset_token(data: dict[str, Any]) -> str:
    """Create a short-lived token for password reset."""
    to_encode = data.copy()
    expire = datetime.now(UTC) + timedelta(minutes=settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "type": "reset_password"})
    algorithm = _validate_algorithm()
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=algorithm)


def decode_password_reset_token(token: str) -> dict[str, Any] | None:
    """Decode and validate a password reset token."""
    try:
        algorithm = _validate_algorithm()
        payload: dict[str, Any] = jwt.decode(token, settings.SECRET_KEY, algorithms=[algorithm])
        if payload.get("type") != "reset_password":
            return None
        return payload
    except jwt.exceptions.InvalidTokenError:
        return None


# OWASP 2026 Argon2id parameters: t=2, m=46 MiB, p=1.
_ph = PasswordHasher(time_cost=2, memory_cost=47104, parallelism=1)


def hash_password(password: str) -> str:
    return _ph.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> tuple[bool, bool]:
    """Return ``(is_valid, needs_rehash)``.

    Supports both argon2id (current) and bcrypt (legacy). A successful bcrypt
    verify always returns ``needs_rehash=True`` so callers silently upgrade the
    stored hash to argon2id on the next login.
    """
    if hashed_password.startswith("$argon2"):
        try:
            _ph.verify(hashed_password, plain_password)
        except (VerificationError, InvalidHashError):
            # VerificationError covers mismatches AND decode errors on malformed
            # hashes; InvalidHashError covers prefix-matching-but-unparseable.
            return False, False
        return True, _ph.check_needs_rehash(hashed_password)

    try:
        ok = bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except ValueError:
        return False, False
    return ok, ok


# ── MFA secret encryption ──────────────────────────────────


def _get_fernet() -> Fernet:
    """Return a Fernet instance using the MFA encryption key."""
    return Fernet(settings.MFA_ENCRYPTION_KEY.encode("utf-8"))


def encrypt_mfa_secret(plaintext: str) -> str:
    """Encrypt an MFA TOTP secret for safe database storage."""
    return _get_fernet().encrypt(plaintext.encode("utf-8")).decode("utf-8")


def decrypt_mfa_secret(ciphertext: str) -> str:
    """Decrypt an MFA TOTP secret from database storage.

    Raises ``InvalidToken`` if the key is wrong or data is corrupted.
    """
    try:
        return _get_fernet().decrypt(ciphertext.encode("utf-8")).decode("utf-8")
    except InvalidToken as exc:
        raise ValueError("Failed to decrypt MFA secret — encryption key may have changed") from exc
