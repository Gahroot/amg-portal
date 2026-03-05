"""User management endpoints (admin only)."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select

from app.api.deps import DB, CurrentUser, require_admin
from app.core.security import hash_password
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.auth import UserResponse
from app.schemas.user import UserCreateByAdmin, UserListResponse, UserUpdate

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
    count_query = select(func.count()).select_from(User)

    if role:
        query = query.where(User.role == role.value)
        count_query = count_query.where(User.role == role.value)
    if status_filter:
        query = query.where(User.status == status_filter)
        count_query = count_query.where(User.status == status_filter)
    if search:
        pattern = f"%{search}%"
        query = query.where(User.email.ilike(pattern) | User.full_name.ilike(pattern))
        count_query = count_query.where(
            User.email.ilike(pattern) | User.full_name.ilike(pattern)
        )

    total = (await db.execute(count_query)).scalar_one()
    result = await db.execute(
        query.order_by(User.created_at.desc()).offset(skip).limit(limit)
    )
    users = result.scalars().all()

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
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@router.patch("/{user_id}", response_model=UserResponse, dependencies=[Depends(require_admin)])
async def update_user(user_id: uuid.UUID, data: UserUpdate, db: DB):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

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
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate yourself",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.status = "inactive"
    await db.commit()
