"""Seed demo accounts for all roles in production."""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select

from app.core.security import hash_password
from app.db.session import AsyncSessionLocal
from app.models.client_profile import ClientProfile
from app.models.partner import PartnerProfile
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


CLIENT_EMAIL = "client@anchormillgroup.com"
PARTNER_EMAIL = "partner@anchormillgroup.com"


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

        # Ensure the demo client user has a ClientProfile so the portal dashboard works
        client_user_result = await db.execute(select(User).where(User.email == CLIENT_EMAIL))
        client_user = client_user_result.scalar_one_or_none()
        if client_user:
            existing_profile = await db.execute(
                select(ClientProfile).where(ClientProfile.user_id == client_user.id)
            )
            if not existing_profile.scalar_one_or_none():
                profile = ClientProfile(
                    legal_name=client_user.full_name,
                    display_name=client_user.full_name,
                    primary_email=client_user.email,
                    user_id=client_user.id,
                    created_by=client_user.id,
                    portal_access_enabled=True,
                    compliance_status="approved",
                    approval_status="approved",
                )
                db.add(profile)
                await db.commit()
                print(f"\nCreated ClientProfile for {CLIENT_EMAIL}")

        # Ensure the demo partner user has a PartnerProfile so the partner portal works
        partner_user_result = await db.execute(select(User).where(User.email == PARTNER_EMAIL))
        partner_user = partner_user_result.scalar_one_or_none()
        if partner_user:
            existing_partner = await db.execute(
                select(PartnerProfile).where(PartnerProfile.user_id == partner_user.id)
            )
            if not existing_partner.scalar_one_or_none():
                partner_profile = PartnerProfile(
                    firm_name="Rossi Advisory",
                    contact_name=partner_user.full_name,
                    contact_email=partner_user.email,
                    user_id=partner_user.id,
                    created_by=partner_user.id,
                    status="active",
                    availability_status="available",
                    capabilities=["Concierge", "Travel", "Lifestyle Management"],
                    geographies=["Europe", "Global"],
                    compliance_verified=True,
                )
                db.add(partner_profile)
                await db.commit()
                print(f"\nCreated PartnerProfile for {PARTNER_EMAIL}")

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
