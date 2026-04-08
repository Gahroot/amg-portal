"""User management endpoints (admin only)."""

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select

from app.api.deps import DB, CurrentUser, require_admin
from app.core.exceptions import BadRequestException, ConflictException, NotFoundException
from app.core.security import hash_password
from app.models.audit_log import AuditLog
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.auth import UserResponse
from app.schemas.user import UserCreateByAdmin, UserListResponse, UserUpdate
from app.services.crud_base import paginate

router = APIRouter()


@router.get("/", response_model=UserListResponse, dependencies=[Depends(require_admin)])
async def list_users(
    db: DB,
    role: UserRole | None = None,
    status_filter: str | None = Query(None, alias="status"),
    search: str | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    query = select(User)

    if role:
        query = query.where(User.role == role.value)
    if status_filter:
        query = query.where(User.status == status_filter)
    if search:
        pattern = f"%{search}%"
        query = query.where(User.email.ilike(pattern) | User.full_name.ilike(pattern))

    query = query.order_by(User.created_at.desc())
    users, total = await paginate(db, query, skip=skip, limit=limit)

    return UserListResponse(users=users, total=total)


@router.post(
    "/",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin)],
)
async def create_user(data: UserCreateByAdmin, db: DB):
    result = await db.execute(select(User).where(User.email == data.email))
    if result.scalar_one_or_none():
        raise ConflictException("Email already registered")

    user = User(
        email=data.email,
        hashed_password=hash_password(data.password),
        full_name=data.full_name,
        role=data.role.value,
        phone_number=data.phone_number,
        status="active",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.get("/{user_id}", response_model=UserResponse, dependencies=[Depends(require_admin)])
async def get_user(user_id: uuid.UUID, db: DB):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise NotFoundException("User not found")
    return user


@router.patch("/{user_id}", response_model=UserResponse, dependencies=[Depends(require_admin)])
async def update_user(user_id: uuid.UUID, data: UserUpdate, db: DB):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise NotFoundException("User not found")

    update_data = data.model_dump(exclude_unset=True)
    if "role" in update_data and update_data["role"] is not None:
        update_data["role"] = update_data["role"].value

    for field, value in update_data.items():
        setattr(user, field, value)

    await db.commit()
    await db.refresh(user)
    return user


@router.delete(
    "/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_admin)],
)
async def delete_user(user_id: uuid.UUID, current_user: CurrentUser, db: DB):
    if user_id == current_user.id:
        raise BadRequestException("Cannot deactivate yourself")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise NotFoundException("User not found")

    user.status = "inactive"
    await db.commit()


@router.post(
    "/{user_id}/deactivate",
    response_model=UserResponse,
    dependencies=[Depends(require_admin)],
)
async def deactivate_user(user_id: uuid.UUID, current_user: CurrentUser, db: DB) -> UserResponse:
    """Deactivate a user account.

    Sets the user status to 'inactive', which immediately prevents them from
    authenticating. Any existing JWT tokens will be rejected on the next
    request since the auth dependency checks user.status. The action is
    written to the audit log for compliance traceability.
    """
    if user_id == current_user.id:
        raise BadRequestException("Cannot deactivate your own account")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise NotFoundException("User not found")

    if user.status == "inactive":
        raise ConflictException("User account is already inactive")

    previous_status = user.status
    user.status = "inactive"

    log = AuditLog(
        user_id=current_user.id,
        user_email=current_user.email,
        action="update",
        entity_type="user",
        entity_id=str(user.id),
        before_state={"status": previous_status},
        after_state={"status": "inactive", "deactivated_at": datetime.now(UTC).isoformat()},
    )
    db.add(log)
    await db.commit()
    await db.refresh(user)
    return UserResponse.model_validate(user)
