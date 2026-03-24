"""API Key management endpoints.

These endpoints allow users to create, list, and revoke their own API keys.
API keys are used for programmatic access to the API.
"""

from uuid import UUID

from fastapi import APIRouter, Query, status
from sqlalchemy import desc, select

from app.api.deps import DB, CurrentUser
from app.core.exceptions import BadRequestException, NotFoundException
from app.models.api_key import APIKey
from app.models.audit_log import AuditLog
from app.models.enums import AuditAction
from app.schemas.api_key import (
    API_KEY_SCOPES,
    APIKeyCreate,
    APIKeyCreatedResponse,
    APIKeyListResponse,
    APIKeyResponse,
    ScopeInfo,
    ScopesResponse,
)

router = APIRouter()


def _validate_scopes(scopes: list[str]) -> None:
    """Validate that all requested scopes are valid."""
    invalid_scopes = [s for s in scopes if s not in API_KEY_SCOPES]
    if invalid_scopes:
        raise BadRequestException(
            f"Invalid scopes: {', '.join(invalid_scopes)}. "
            f"Valid scopes: {', '.join(API_KEY_SCOPES.keys())}"
        )


@router.get("/scopes", response_model=ScopesResponse)
async def list_scopes() -> ScopesResponse:
    """List all available API key scopes with descriptions."""
    return ScopesResponse(
        scopes=[
            ScopeInfo(name=name, description=desc)
            for name, desc in API_KEY_SCOPES.items()
        ]
    )


@router.get("", response_model=APIKeyListResponse)
async def list_api_keys(
    current_user: CurrentUser,
    db: DB,
    include_inactive: bool = Query(False, description="Include revoked/expired keys"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> APIKeyListResponse:
    """List all API keys for the current user."""
    query = select(APIKey).where(APIKey.user_id == current_user.id)

    if not include_inactive:
        query = query.where(APIKey.is_active == True)  # noqa: E712

    # Get total count
    count_query = select(APIKey).where(APIKey.user_id == current_user.id)
    if not include_inactive:
        count_query = count_query.where(APIKey.is_active == True)  # noqa: E712
    total_result = await db.execute(count_query)
    total = len(total_result.all())

    # Get paginated results
    query = query.order_by(desc(APIKey.created_at)).offset(offset).limit(limit)
    result = await db.execute(query)
    api_keys = result.scalars().all()

    return APIKeyListResponse(
        items=[APIKeyResponse.model_validate(key) for key in api_keys],
        total=total,
    )


@router.post("", response_model=APIKeyCreatedResponse, status_code=status.HTTP_201_CREATED)
async def create_api_key(
    data: APIKeyCreate,
    current_user: CurrentUser,
    db: DB,
) -> APIKeyCreatedResponse:
    """Create a new API key.

    **Important:** The returned `key` value is shown only once. Store it securely!
    """
    # Validate scopes
    _validate_scopes(data.scopes)

    # Check if user has reached the maximum number of active keys
    active_keys_query = select(APIKey).where(
        APIKey.user_id == current_user.id,
        APIKey.is_active == True,  # noqa: E712
    )
    active_keys_result = await db.execute(active_keys_query)
    active_keys = active_keys_result.scalars().all()

    if len(active_keys) >= 10:
        raise BadRequestException(
            "Maximum number of API keys reached (10). "
            "Please revoke an existing key before creating a new one."
        )

    # Create the API key
    api_key, plain_key = APIKey.create(
        user_id=current_user.id,
        name=data.name,
        scopes=data.scopes,
        expires_at=data.get_expires_at(),
        rate_limit=data.rate_limit,
    )

    db.add(api_key)
    await db.commit()
    await db.refresh(api_key)

    # Log the creation
    audit_log = AuditLog(
        user_id=current_user.id,
        user_email=current_user.email,
        action=AuditAction.create,
        entity_type="api_key",
        entity_id=str(api_key.id),
        after_state={
            "name": api_key.name,
            "scopes": api_key.scopes,
            "expires_at": api_key.expires_at.isoformat() if api_key.expires_at else None,
        },
    )
    db.add(audit_log)
    await db.commit()

    return APIKeyCreatedResponse(
        id=api_key.id,
        name=api_key.name,
        key=plain_key,
        key_prefix=api_key.key_prefix,
        scopes=api_key.scopes,
        is_active=api_key.is_active,
        last_used_at=api_key.last_used_at,
        expires_at=api_key.expires_at,
        created_at=api_key.created_at,
    )


@router.get("/{key_id}", response_model=APIKeyResponse)
async def get_api_key(
    key_id: str,
    current_user: CurrentUser,
    db: DB,
) -> APIKeyResponse:
    """Get details of a specific API key."""
    try:
        key_uuid = UUID(key_id)
    except ValueError:
        raise BadRequestException("Invalid API key ID format") from None

    result = await db.execute(
        select(APIKey).where(APIKey.id == key_uuid, APIKey.user_id == current_user.id)
    )
    api_key = result.scalar_one_or_none()

    if not api_key:
        raise NotFoundException("API key not found")

    return APIKeyResponse.model_validate(api_key)


@router.post("/{key_id}/revoke", response_model=APIKeyResponse)
async def revoke_api_key(
    key_id: str,
    current_user: CurrentUser,
    db: DB,
) -> APIKeyResponse:
    """Revoke an API key.

    This action cannot be undone. You will need to create a new key if you need access again.
    """
    try:
        key_uuid = UUID(key_id)
    except ValueError:
        raise BadRequestException("Invalid API key ID format") from None

    result = await db.execute(
        select(APIKey).where(APIKey.id == key_uuid, APIKey.user_id == current_user.id)
    )
    api_key = result.scalar_one_or_none()

    if not api_key:
        raise NotFoundException("API key not found")

    if not api_key.is_active:
        raise BadRequestException("API key is already revoked")

    # Revoke the key
    api_key.revoke(current_user.id)

    # Log the revocation
    audit_log = AuditLog(
        user_id=current_user.id,
        user_email=current_user.email,
        action=AuditAction.update,
        entity_type="api_key",
        entity_id=str(api_key.id),
        after_state={
            "name": api_key.name,
            "revoked_at": api_key.revoked_at.isoformat() if api_key.revoked_at else None,
            "is_active": False,
        },
    )
    db.add(audit_log)
    await db.commit()
    await db.refresh(api_key)

    return APIKeyResponse.model_validate(api_key)


@router.post(
    "/{key_id}/regenerate",
    response_model=APIKeyCreatedResponse,
    status_code=status.HTTP_201_CREATED,
)
async def regenerate_api_key(
    key_id: str,
    current_user: CurrentUser,
    db: DB,
) -> APIKeyCreatedResponse:
    """Regenerate an API key.

    **Warning:** This will revoke the existing key immediately. The new key is shown only once.
    """
    try:
        key_uuid = UUID(key_id)
    except ValueError:
        raise BadRequestException("Invalid API key ID format") from None

    result = await db.execute(
        select(APIKey).where(APIKey.id == key_uuid, APIKey.user_id == current_user.id)
    )
    old_key = result.scalar_one_or_none()

    if not old_key:
        raise NotFoundException("API key not found")

    # Create a new key with the same properties
    new_key, plain_key = APIKey.create(
        user_id=current_user.id,
        name=old_key.name,
        scopes=old_key.scopes,
        expires_at=old_key.expires_at,
        rate_limit=old_key.rate_limit,
    )

    # Revoke the old key
    old_key.revoke(current_user.id)

    db.add(new_key)
    await db.commit()
    await db.refresh(new_key)

    # Log the regeneration
    audit_log = AuditLog(
        user_id=current_user.id,
        user_email=current_user.email,
        action=AuditAction.update,
        entity_type="api_key",
        entity_id=str(new_key.id),
        after_state={
            "name": new_key.name,
            "regenerated_from": str(old_key.id),
            "scopes": new_key.scopes,
        },
    )
    db.add(audit_log)
    await db.commit()

    return APIKeyCreatedResponse(
        id=new_key.id,
        name=new_key.name,
        key=plain_key,
        key_prefix=new_key.key_prefix,
        scopes=new_key.scopes,
        is_active=new_key.is_active,
        last_used_at=new_key.last_used_at,
        expires_at=new_key.expires_at,
        created_at=new_key.created_at,
    )


@router.delete("/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_api_key(
    key_id: str,
    current_user: CurrentUser,
    db: DB,
) -> None:
    """Permanently delete an API key.

    This removes the key from the database entirely. Prefer revoke for audit purposes.
    """
    try:
        key_uuid = UUID(key_id)
    except ValueError:
        raise BadRequestException("Invalid API key ID format") from None

    result = await db.execute(
        select(APIKey).where(APIKey.id == key_uuid, APIKey.user_id == current_user.id)
    )
    api_key = result.scalar_one_or_none()

    if not api_key:
        raise NotFoundException("API key not found")

    # Log the deletion before removing
    audit_log = AuditLog(
        user_id=current_user.id,
        user_email=current_user.email,
        action=AuditAction.delete,
        entity_type="api_key",
        entity_id=str(api_key.id),
        before_state={
            "name": api_key.name,
            "is_active": api_key.is_active,
        },
    )
    db.add(audit_log)

    await db.delete(api_key)
    await db.commit()
