from datetime import UTC, datetime, timedelta
from typing import Any

import bcrypt
from jose import JWTError, jwt

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
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=algorithm)  # type: ignore[no-any-return]


def create_refresh_token(data: dict[str, Any]) -> str:
    to_encode = data.copy()
    expire = datetime.now(UTC) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    algorithm = _validate_algorithm()
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=algorithm)  # type: ignore[no-any-return]


def decode_access_token(token: str) -> dict[str, Any] | None:
    try:
        algorithm = _validate_algorithm()
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[algorithm])  # type: ignore[no-any-return]
        if payload.get("type") != "access":
            return None
        return payload
    except JWTError:
        return None


def decode_refresh_token(token: str) -> dict[str, Any] | None:
    try:
        algorithm = _validate_algorithm()
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[algorithm])  # type: ignore[no-any-return]
        if payload.get("type") != "refresh":
            return None
        return payload
    except JWTError:
        return None


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
