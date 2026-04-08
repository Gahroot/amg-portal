"""Seed initial Managing Director user."""

import asyncio
import os

from sqlalchemy import select

from app.core.security import hash_password
from app.db.session import AsyncSessionLocal
from app.models.enums import UserRole
from app.models.user import User


async def seed_admin() -> None:
    password = os.environ.get("AMG_ADMIN_PASSWORD", "AdminPass123!")

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.email == "admin@anchormillgroup.com"))
        if result.scalar_one_or_none():
            print("Admin user already exists, skipping.")
            return

        user = User(
            email="admin@anchormillgroup.com",
            hashed_password=hash_password(password),
            full_name="System Administrator",
            role=UserRole.managing_director.value,
            status="active",
        )
        db.add(user)
        await db.commit()
        password_source = (
            "AMG_ADMIN_PASSWORD env var"
            if os.environ.get("AMG_ADMIN_PASSWORD")
            else "default password"
        )
        print(f"Admin user created: admin@anchormillgroup.com (password source: {password_source})")


if __name__ == "__main__":
    asyncio.run(seed_admin())
