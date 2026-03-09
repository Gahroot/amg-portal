from collections.abc import AsyncGenerator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def apply_rls_context(
    session: AsyncSession,
    user_id: str,
    user_role: str,
) -> None:
    """Set PostgreSQL session variables for row-level security.

    Uses SET LOCAL so the settings are scoped to the current transaction
    and automatically reset when the transaction ends.
    """
    await session.execute(
        text("SET LOCAL app.current_user_id = :user_id"),
        {"user_id": user_id},
    )
    await session.execute(
        text("SET LOCAL app.current_user_role = :role"),
        {"role": user_role},
    )
