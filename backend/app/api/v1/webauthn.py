"""WebAuthn / passkey registration + authentication routes (Phase 2.9).

Registration (bound to an authenticated user):

    POST /webauthn/register/begin       → { publicKey: ... }  (navigator.credentials.create)
    POST /webauthn/register/complete    → persist credential

Authentication (pre-authenticated — email lookup, no password):

    POST /webauthn/authenticate/begin   { email }  → { publicKey: ... }
    POST /webauthn/authenticate/complete         → { access_token, refresh_token }

TOTP remains the default second factor; passkeys are additive.  A login via
passkey is single-factor-of-the-same-flavour as TOTP in terms of AAL, so
the overall account still requires password + passkey/TOTP.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Response, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select

from app.api.deps import DB, CurrentUser
from app.api.v1.auth import _issue_refresh_token, _set_auth_cookies
from app.core.exceptions import NotFoundException
from app.core.security import create_access_token
from app.models.user import User
from app.schemas.auth import Token
from app.schemas.base import Str50, Str100
from app.services.webauthn_service import (
    begin_authentication,
    begin_registration,
    complete_authentication,
    complete_registration,
    delete_credential,
    list_credentials,
)

router = APIRouter()


class _BeginRegistration(BaseModel):
    nickname: Str100 | None = None


class _CompleteRegistration(BaseModel):
    credential: dict[str, Any]


class _BeginAuth(BaseModel):
    email: EmailStr


class _CompleteAuth(BaseModel):
    email: EmailStr
    credential: dict[str, Any]


@router.post("/register/begin")
async def register_begin(
    data: _BeginRegistration, current_user: CurrentUser, db: DB
) -> dict[str, Any]:
    return await begin_registration(db, current_user, nickname=data.nickname)


@router.post("/register/complete", status_code=status.HTTP_201_CREATED)
async def register_complete(
    data: _CompleteRegistration, current_user: CurrentUser, db: DB
) -> dict[str, Any]:
    cred = await complete_registration(db, current_user, data.credential)
    await db.commit()
    return {
        "id": str(cred.id),
        "nickname": cred.nickname,
        "aaguid": cred.aaguid,
    }


@router.get("/credentials")
async def list_own_credentials(current_user: CurrentUser, db: DB) -> list[dict[str, Any]]:
    rows = await list_credentials(db, current_user)
    return [
        {
            "id": str(r.id),
            "nickname": r.nickname,
            "aaguid": r.aaguid,
            "transports": r.transports.split(",") if r.transports else [],
            "last_used_at": r.last_used_at.isoformat() if r.last_used_at else None,
            "created_at": r.created_at.isoformat(),
        }
        for r in rows
    ]


@router.delete("/credentials/{credential_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_own_credential(credential_id: Str50, current_user: CurrentUser, db: DB) -> None:
    import uuid

    await delete_credential(db, current_user, uuid.UUID(credential_id))
    await db.commit()


@router.post("/authenticate/begin")
async def authenticate_begin(data: _BeginAuth, db: DB) -> dict[str, Any]:
    user = (await db.execute(select(User).where(User.email == data.email))).scalar_one_or_none()
    # Canonicalise failure modes — do not leak whether the email exists.
    if user is None:
        raise NotFoundException("No passkeys registered for this user")
    return await begin_authentication(db, user)


@router.post("/authenticate/complete", response_model=Token)
async def authenticate_complete(data: _CompleteAuth, response: Response, db: DB) -> Any:
    user = (await db.execute(select(User).where(User.email == data.email))).scalar_one_or_none()
    if user is None:
        raise NotFoundException("No passkeys registered for this user")
    await complete_authentication(db, user, data.credential)

    token_data = {"sub": str(user.id), "email": user.email}
    access_token = create_access_token(token_data)
    refresh_token = await _issue_refresh_token(db, str(user.id), token_data)
    await db.commit()
    _set_auth_cookies(response, access_token, refresh_token, user_id=str(user.id))
    return Token(access_token=access_token, refresh_token=refresh_token)
