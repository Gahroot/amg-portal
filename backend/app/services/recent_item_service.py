"""Service for recent item operations."""

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import and_, delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.recent_item import RecentItem
from app.schemas.recent_item import RecentItemCreate, RecentItemType

# Maximum recent items per user
MAX_RECENT_ITEMS = 20

# Items expire after this many days
EXPIRATION_DAYS = 30


class RecentItemService:
    """Service for managing user's recent items."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_recent_items(
        self,
        user_id: uuid.UUID,
        limit: int = 20,
        item_type: RecentItemType | None = None,
    ) -> list[RecentItem]:
        """Get recent items for a user, optionally filtered by type."""
        # First, clean up expired items
        await self._cleanup_expired_items(user_id)

        query = (
            select(RecentItem)
            .where(RecentItem.user_id == user_id)
            .order_by(RecentItem.viewed_at.desc())
            .limit(limit)
        )

        if item_type:
            query = query.where(RecentItem.item_type == item_type.value)

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def record_view(
        self,
        user_id: uuid.UUID,
        data: RecentItemCreate,
    ) -> RecentItem:
        """Record a view of an item, updating if it already exists."""
        # Check if this item already exists for this user
        existing_result = await self.db.execute(
            select(RecentItem).where(
                and_(
                    RecentItem.user_id == user_id,
                    RecentItem.item_type == data.item_type.value,
                    RecentItem.item_id == data.item_id,
                )
            )
        )
        existing = existing_result.scalar_one_or_none()

        now = datetime.now(UTC)

        if existing:
            # Update the viewed_at timestamp and title info (in case it changed)
            existing.viewed_at = now
            existing.item_title = data.item_title
            existing.item_subtitle = data.item_subtitle
            await self.db.commit()
            await self.db.refresh(existing)
            return existing

        # Create new recent item
        recent_item = RecentItem(
            user_id=user_id,
            item_type=data.item_type.value,
            item_id=data.item_id,
            item_title=data.item_title,
            item_subtitle=data.item_subtitle,
            viewed_at=now,
        )
        self.db.add(recent_item)
        await self.db.commit()
        await self.db.refresh(recent_item)

        # Enforce max items limit
        await self._enforce_limit(user_id)

        return recent_item

    async def delete_recent_item(
        self,
        user_id: uuid.UUID,
        item_id: uuid.UUID,
    ) -> bool:
        """Delete a specific recent item."""
        result = await self.db.execute(
            delete(RecentItem)
            .where(and_(RecentItem.id == item_id, RecentItem.user_id == user_id))
            .returning(RecentItem.id)
        )
        await self.db.commit()
        deleted = result.scalar_one_or_none()
        return deleted is not None

    async def clear_all_recent_items(self, user_id: uuid.UUID) -> int:
        """Clear all recent items for a user."""
        result = await self.db.execute(
            delete(RecentItem)
            .where(RecentItem.user_id == user_id)
            .returning(RecentItem.id)
        )
        await self.db.commit()
        items = result.scalars().all()
        return len(items)

    async def _enforce_limit(self, user_id: uuid.UUID) -> None:
        """Ensure user doesn't have more than MAX_RECENT_ITEMS."""
        # Count current items
        count_result = await self.db.execute(
            select(func.count()).where(RecentItem.user_id == user_id)
        )
        count = count_result.scalar_one()

        if count > MAX_RECENT_ITEMS:
            # Delete oldest items beyond the limit
            # Get the viewed_at of the 20th most recent item
            cutoff_result = await self.db.execute(
                select(RecentItem.viewed_at)
                .where(RecentItem.user_id == user_id)
                .order_by(RecentItem.viewed_at.desc())
                .offset(MAX_RECENT_ITEMS - 1)
                .limit(1)
            )
            cutoff = cutoff_result.scalar_one_or_none()

            if cutoff:
                await self.db.execute(
                    delete(RecentItem).where(
                        and_(
                            RecentItem.user_id == user_id,
                            RecentItem.viewed_at < cutoff,
                        )
                    )
                )
                await self.db.commit()

    async def _cleanup_expired_items(self, user_id: uuid.UUID) -> int:
        """Remove items older than EXPIRATION_DAYS."""
        cutoff = datetime.now(UTC) - timedelta(days=EXPIRATION_DAYS)
        result = await self.db.execute(
            delete(RecentItem)
            .where(and_(RecentItem.user_id == user_id, RecentItem.viewed_at < cutoff))
            .returning(RecentItem.id)
        )
        items = result.scalars().all()
        if items:
            await self.db.commit()
        return len(items)
