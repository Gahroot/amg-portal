"""API endpoints for saved table views."""

from uuid import UUID

from fastapi import APIRouter, Query, status
from sqlalchemy import or_, select

from app.api.deps import DB, CurrentUser
from app.core.exceptions import ForbiddenException, NotFoundException
from app.models.table_view import TableView
from app.schemas.table_view import (
    TableViewCreate,
    TableViewListResponse,
    TableViewResponse,
    TableViewSummary,
    TableViewUpdate,
)

router = APIRouter(tags=["table-views"])


def _build_view_response(view: TableView, current_user_id: UUID) -> TableViewResponse:
    """Build a response for a table view with computed fields."""
    return TableViewResponse(
        id=view.id,
        user_id=view.user_id,
        table_id=view.table_id,
        name=view.name,
        description=view.description,
        filters=view.filters,
        sort=view.sort,
        columns=view.columns,
        column_order=view.column_order,
        column_sizes=view.column_sizes,
        is_shared=view.is_shared,
        is_default=view.is_default,
        created_at=view.created_at,
        updated_at=view.updated_at,
        is_owner=view.user_id == current_user_id,
        created_by_name=view.user.full_name if view.user else None,
    )


def _build_view_summary(view: TableView, current_user_id: UUID) -> TableViewSummary:
    """Build a summary for a table view."""
    return TableViewSummary(
        id=view.id,
        table_id=view.table_id,
        name=view.name,
        description=view.description,
        is_shared=view.is_shared,
        is_default=view.is_default,
        is_owner=view.user_id == current_user_id,
        created_by_name=view.user.full_name if view.user else None,
        updated_at=view.updated_at,
    )


@router.get("/table-views", response_model=TableViewListResponse)
async def list_table_views(
    current_user: CurrentUser,
    db: DB,
    table_id: str | None = Query(None, description="Filter by table ID"),
    include_shared: bool = Query(True, description="Include shared views from others"),
) -> TableViewListResponse:
    """List all saved table views for the current user.

    Returns user's own views plus shared views from other team members.
    Optionally filter by table_id.
    """
    # Build query conditions
    conditions = [TableView.user_id == current_user.id]
    if include_shared:
        conditions.append(TableView.is_shared == True)  # noqa: E712

    query = (
        select(TableView)
        .where(or_(*conditions))
        .order_by(TableView.table_id, TableView.is_default.desc(), TableView.name)
    )

    if table_id:
        query = query.where(TableView.table_id == table_id)

    result = await db.execute(query)
    views = result.scalars().all()

    # Filter out duplicates (own views that are also shared)
    seen_ids: set[UUID] = set()
    unique_views: list[TableView] = []
    for view in views:
        if view.id not in seen_ids:
            seen_ids.add(view.id)
            unique_views.append(view)

    return TableViewListResponse(
        items=[_build_view_summary(v, current_user.id) for v in unique_views],
        total=len(unique_views),
    )


@router.get("/table-views/{view_id}", response_model=TableViewResponse)
async def get_table_view(
    view_id: UUID,
    current_user: CurrentUser,
    db: DB,
) -> TableViewResponse:
    """Get a specific saved table view by ID.

    User must be the owner or the view must be shared.
    """
    result = await db.execute(select(TableView).where(TableView.id == view_id))
    view = result.scalar_one_or_none()

    if not view:
        raise NotFoundException("Table view not found")

    # Check access: owner or shared
    if view.user_id != current_user.id and not view.is_shared:
        raise ForbiddenException("You do not have access to this view")

    return _build_view_response(view, current_user.id)


@router.post(
    "/table-views", response_model=TableViewResponse, status_code=status.HTTP_201_CREATED
)
async def create_table_view(
    data: TableViewCreate,
    current_user: CurrentUser,
    db: DB,
) -> TableViewResponse:
    """Create a new saved table view."""
    # If setting as default, unset any existing default for this table/user
    if data.is_default:
        existing_result = await db.execute(
            select(TableView).where(
                TableView.user_id == current_user.id,
                TableView.table_id == data.table_id,
                TableView.is_default == True,  # noqa: E712
            )
        )
        for existing in existing_result.scalars().all():
            existing.is_default = False

    view = TableView(
        user_id=current_user.id,
        table_id=data.table_id,
        name=data.name,
        description=data.description,
        filters=data.filters,
        sort=data.sort,
        columns=data.columns,
        column_order=data.column_order,
        column_sizes=data.column_sizes,
        is_shared=data.is_shared,
        is_default=data.is_default,
    )

    db.add(view)
    await db.commit()
    await db.refresh(view)

    return _build_view_response(view, current_user.id)


@router.patch("/table-views/{view_id}", response_model=TableViewResponse)
async def update_table_view(
    view_id: UUID,
    data: TableViewUpdate,
    current_user: CurrentUser,
    db: DB,
) -> TableViewResponse:
    """Update a saved table view.

    Only the owner can update a view.
    """
    result = await db.execute(select(TableView).where(TableView.id == view_id))
    view = result.scalar_one_or_none()

    if not view:
        raise NotFoundException("Table view not found")

    if view.user_id != current_user.id:
        raise ForbiddenException("Only the owner can update this view")

    # Update fields
    update_data = data.model_dump(exclude_unset=True)

    # Handle is_default update
    if update_data.get("is_default"):
        # Unset any existing default for this table/user
        existing_result = await db.execute(
            select(TableView).where(
                TableView.user_id == current_user.id,
                TableView.table_id == view.table_id,
                TableView.is_default == True,  # noqa: E712
                TableView.id != view_id,
            )
        )
        for existing in existing_result.scalars().all():
            existing.is_default = False

    for field, value in update_data.items():
        setattr(view, field, value)

    await db.commit()
    await db.refresh(view)

    return _build_view_response(view, current_user.id)


@router.delete("/table-views/{view_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_table_view(
    view_id: UUID,
    current_user: CurrentUser,
    db: DB,
) -> None:
    """Delete a saved table view.

    Only the owner can delete a view.
    """
    result = await db.execute(select(TableView).where(TableView.id == view_id))
    view = result.scalar_one_or_none()

    if not view:
        raise NotFoundException("Table view not found")

    if view.user_id != current_user.id:
        raise ForbiddenException("Only the owner can delete this view")

    await db.delete(view)
    await db.commit()


@router.post("/table-views/{view_id}/set-default", response_model=TableViewResponse)
async def set_default_view(
    view_id: UUID,
    current_user: CurrentUser,
    db: DB,
) -> TableViewResponse:
    """Set a view as the default for its table.

    Only the owner can set their default. Shared views cannot be set as
    default by non-owners.
    """
    result = await db.execute(select(TableView).where(TableView.id == view_id))
    view = result.scalar_one_or_none()

    if not view:
        raise NotFoundException("Table view not found")

    if view.user_id != current_user.id:
        raise ForbiddenException("Only the owner can set this as default")

    # Unset any existing default for this table/user
    existing_result = await db.execute(
        select(TableView).where(
            TableView.user_id == current_user.id,
            TableView.table_id == view.table_id,
            TableView.is_default == True,  # noqa: E712
        )
    )
    for existing in existing_result.scalars().all():
        existing.is_default = False

    # Set this view as default
    view.is_default = True

    await db.commit()
    await db.refresh(view)

    return _build_view_response(view, current_user.id)


@router.get(
    "/table-views/default/{table_id}", response_model=TableViewResponse | None
)
async def get_default_view(
    table_id: str,
    current_user: CurrentUser,
    db: DB,
) -> TableViewResponse | None:
    """Get the default view for a specific table.

    Returns the user's default view for the table, or None if no default is set.
    """
    result = await db.execute(
        select(TableView).where(
            TableView.user_id == current_user.id,
            TableView.table_id == table_id,
            TableView.is_default == True,  # noqa: E712
        )
    )
    view = result.scalar_one_or_none()

    if not view:
        return None

    return _build_view_response(view, current_user.id)


@router.post("/table-views/{view_id}/duplicate", response_model=TableViewResponse)
async def duplicate_view(
    view_id: UUID,
    current_user: CurrentUser,
    db: DB,
) -> TableViewResponse:
    """Duplicate a view (creates a new view owned by the current user).

    Can duplicate own views or shared views from others.
    """
    result = await db.execute(select(TableView).where(TableView.id == view_id))
    view = result.scalar_one_or_none()

    if not view:
        raise NotFoundException("Table view not found")

    # Check access: owner or shared
    if view.user_id != current_user.id and not view.is_shared:
        raise ForbiddenException("You do not have access to this view")

    # Create a copy
    new_view = TableView(
        user_id=current_user.id,
        table_id=view.table_id,
        name=f"Copy of {view.name}",
        description=view.description,
        filters=view.filters,
        sort=view.sort,
        columns=view.columns,
        column_order=view.column_order,
        column_sizes=view.column_sizes,
        is_shared=False,
        is_default=False,
    )

    db.add(new_view)
    await db.commit()
    await db.refresh(new_view)

    return _build_view_response(new_view, current_user.id)
