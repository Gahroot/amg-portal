"""Saved filter preset endpoints."""

import uuid

from fastapi import APIRouter, status
from sqlalchemy import select, update

from app.api.deps import DB, CurrentUser
from app.core.exceptions import NotFoundException
from app.models.saved_filter import SavedFilter
from app.schemas.saved_filter import (
    SavedFilterCreate,
    SavedFilterEntityType,
    SavedFilterListResponse,
    SavedFilterResponse,
    SavedFilterUpdate,
)

router = APIRouter()


@router.get("/", response_model=SavedFilterListResponse)
async def list_saved_filters(
    current_user: CurrentUser,
    db: DB,
    entity_type: SavedFilterEntityType | None = None,
) -> SavedFilterListResponse:
    """Get all saved filters for the current user."""
    query = select(SavedFilter).where(SavedFilter.user_id == current_user.id)
    if entity_type is not None:
        query = query.where(SavedFilter.entity_type == entity_type.value)
    query = query.order_by(SavedFilter.name)
    result = await db.execute(query)
    items = result.scalars().all()
    return SavedFilterListResponse(
        items=[SavedFilterResponse.model_validate(item) for item in items],
        total=len(items),
    )


@router.post(
    "/", response_model=SavedFilterResponse, status_code=status.HTTP_201_CREATED
)
async def create_saved_filter(
    data: SavedFilterCreate,
    current_user: CurrentUser,
    db: DB,
) -> SavedFilterResponse:
    """Create a new saved filter preset."""
    # If setting as default, unset other defaults for same entity_type
    if data.is_default:
        await db.execute(
            update(SavedFilter)
            .where(
                SavedFilter.user_id == current_user.id,
                SavedFilter.entity_type == data.entity_type.value,
                SavedFilter.is_default == True,  # noqa: E712
            )
            .values(is_default=False)
        )
    saved_filter = SavedFilter(
        user_id=current_user.id,
        name=data.name,
        entity_type=data.entity_type.value,
        filter_config=data.filter_config,
        is_default=data.is_default,
    )
    db.add(saved_filter)
    await db.commit()
    await db.refresh(saved_filter)
    return SavedFilterResponse.model_validate(saved_filter)


@router.put("/{filter_id}", response_model=SavedFilterResponse)
async def update_saved_filter(
    filter_id: uuid.UUID,
    data: SavedFilterUpdate,
    current_user: CurrentUser,
    db: DB,
) -> SavedFilterResponse:
    """Update a saved filter preset."""
    result = await db.execute(
        select(SavedFilter).where(
            SavedFilter.id == filter_id,
            SavedFilter.user_id == current_user.id,
        )
    )
    saved_filter = result.scalar_one_or_none()
    if not saved_filter:
        raise NotFoundException("Saved filter not found")
    update_data = data.model_dump(exclude_unset=True)
    # If setting as default, unset other defaults
    if update_data.get("is_default"):
        await db.execute(
            update(SavedFilter)
            .where(
                SavedFilter.user_id == current_user.id,
                SavedFilter.entity_type == saved_filter.entity_type,
                SavedFilter.is_default == True,  # noqa: E712
                SavedFilter.id != filter_id,
            )
            .values(is_default=False)
        )
    for field, value in update_data.items():
        setattr(saved_filter, field, value)
    await db.commit()
    await db.refresh(saved_filter)
    return SavedFilterResponse.model_validate(saved_filter)


@router.delete("/{filter_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_saved_filter(
    filter_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
) -> None:
    """Delete a saved filter preset."""
    result = await db.execute(
        select(SavedFilter).where(
            SavedFilter.id == filter_id,
            SavedFilter.user_id == current_user.id,
        )
    )
    saved_filter = result.scalar_one_or_none()
    if not saved_filter:
        raise NotFoundException("Saved filter not found")
    await db.delete(saved_filter)
    await db.commit()
