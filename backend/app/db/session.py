from collections.abc import AsyncGenerator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.SQL_ECHO,
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

    Note: PostgreSQL's SET command does not support query parameters ($n /
    :name), so the values are interpolated directly.  Both inputs come from
    the verified JWT/session context (UUID and a known enum string) so
    there is no injection risk here.
    """
    # Sanitise inputs: UUIDs contain only hex digits and hyphens; roles only
    # alphanumeric chars and underscores — no quoting required.
    safe_id = "".join(c for c in user_id if c in "0123456789abcdefABCDEF-")
    safe_role = "".join(c for c in user_role if c.isalnum() or c == "_")
    await session.execute(text(f"SET LOCAL app.current_user_id = '{safe_id}'"))
    await session.execute(text(f"SET LOCAL app.current_user_role = '{safe_role}'"))
