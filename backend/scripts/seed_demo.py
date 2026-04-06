"""Seed demo accounts for all roles in production."""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select

from app.core.security import hash_password
from app.db.session import AsyncSessionLocal
from app.models.user import User

DEMO_PASSWORD = "Demo1234!"

DEMO_USERS = [
    {
        "email": "md@anchormillgroup.com",
        "full_name": "Alexandra Whitmore",
        "role": "managing_director",
    },
    {
        "email": "rm@anchormillgroup.com",
        "full_name": "James Harrington",
        "role": "relationship_manager",
    },
    {
        "email": "coordinator@anchormillgroup.com",
        "full_name": "Sofia Nakamura",
        "role": "coordinator",
    },
    {
        "email": "finance@anchormillgroup.com",
        "full_name": "Marcus Chen",
        "role": "finance_compliance",
    },
    {
        "email": "client@anchormillgroup.com",
        "full_name": "Lord Edward Pemberton",
        "role": "client",
    },
    {
        "email": "partner@anchormillgroup.com",
        "full_name": "Isabella Rossi",
        "role": "partner",
    },
]


async def seed_demo() -> None:
    hashed = hash_password(DEMO_PASSWORD)

    async with AsyncSessionLocal() as db:
        created = []
        skipped = []

        for data in DEMO_USERS:
            result = await db.execute(select(User).where(User.email == data["email"]))
            existing = result.scalar_one_or_none()

            if existing:
                skipped.append(data["email"])
                continue

            user = User(
                email=data["email"],
                hashed_password=hashed,
                full_name=data["full_name"],
                role=data["role"],
                status="active",
            )
            db.add(user)
            created.append(data["email"])

        await db.commit()

    print(f"\nDemo password: {DEMO_PASSWORD}\n")
    if created:
        print("Created:")
        for email in created:
            print(f"  + {email}")
    if skipped:
        print("Already existed (skipped):")
        for email in skipped:
            print(f"  ~ {email}")


if __name__ == "__main__":
    asyncio.run(seed_demo())
