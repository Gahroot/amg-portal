"""Push token management endpoints."""

from fastapi import APIRouter

from app.api.deps import DB, CurrentUser
from app.core.exceptions import NotFoundException
from app.schemas.push_token import (
    PushTokenListResponse,
    PushTokenRegisterRequest,
    PushTokenResponse,
)
from app.services.push_service import push_service

router = APIRouter()


@router.post("/", response_model=PushTokenResponse, status_code=201)
async def register_push_token(
    data: PushTokenRegisterRequest,
    db: DB,
    current_user: CurrentUser,
):
    """Register a push notification token for the current user."""
    push_token = await push_service.register_token(
        db,
        user_id=current_user.id,
        token=data.token,
        platform=data.platform,
        device_name=data.device_name,
    )
    return push_token


@router.get("/", response_model=PushTokenListResponse)
async def list_push_tokens(
    db: DB,
    current_user: CurrentUser,
):
    """List all push tokens for the current user."""
    tokens = await push_service.get_tokens_for_user(db, current_user.id)
    return PushTokenListResponse(tokens=tokens, total=len(tokens))


@router.delete("/{token}", status_code=204)
async def unregister_push_token(
    token: str,
    db: DB,
    current_user: CurrentUser,
):
    """Unregister a push notification token."""
    deleted = await push_service.unregister_token(db, current_user.id, token)
    if not deleted:
        raise NotFoundException("Push token not found")
