"""API dependencies — auth + RBAC.

Role checkers mapped to the AMG Portal Design Doc (Section 02) permission matrix:

  require_admin             → Managing Director only (full access, no restrictions)
  require_rm_or_above       → Managing Director + Relationship Manager
  require_coordinator_or_above → MD + RM + Coordinator (program execution layer)
  require_compliance        → Finance & Compliance + Managing Director (billing, invoicing,
                              audit logs — no program execution tools)
  require_internal          → All four internal roles (catch-all for read-only views shared
                              across the internal team)
  require_partner           → Partner tier only (scoped to their own assignments)
"""

from typing import Annotated, Any

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_access_token
from app.db.session import apply_rls_context, get_db
from app.models.enums import UserRole
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception

    user_id_str: str | None = payload.get("sub")
    if user_id_str is None:
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == user_id_str))
    user = result.scalar_one_or_none()

    if user is None:
        raise credentials_exception

    if user.status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user",
        )

    return user


# Type aliases
CurrentUser = Annotated[User, Depends(get_current_user)]
DB = Annotated[AsyncSession, Depends(get_db)]


class RoleChecker:
    """Callable dependency that checks user role against allowed roles."""

    def __init__(self, allowed_roles: list[UserRole]) -> Any:
        self.allowed_roles = [r.value for r in allowed_roles]

    async def __call__(
        self,
        current_user: CurrentUser,
    ) -> User:
        if current_user.role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user


# Pre-built role checkers
require_internal = RoleChecker(
    [
        UserRole.managing_director,
        UserRole.relationship_manager,
        UserRole.coordinator,
        UserRole.finance_compliance,
    ]
)

require_admin = RoleChecker([UserRole.managing_director])

require_rm_or_above = RoleChecker(
    [
        UserRole.managing_director,
        UserRole.relationship_manager,
    ]
)

require_coordinator_or_above = RoleChecker(
    [
        UserRole.managing_director,
        UserRole.relationship_manager,
        UserRole.coordinator,
    ]
)

require_compliance = RoleChecker([UserRole.finance_compliance, UserRole.managing_director])

require_partner = RoleChecker([UserRole.partner])


async def get_current_partner_profile(
    current_user: CurrentUser,
    db: DB,
):
    from app.models.partner import PartnerProfile

    result = await db.execute(
        select(PartnerProfile).where(PartnerProfile.user_id == current_user.id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Partner profile not found",
        )
    return profile


CurrentPartner = Annotated[object, Depends(get_current_partner_profile)]


async def with_rls(db: DB, current_user: CurrentUser) -> None:
    """Dependency that sets RLS context on the current DB session."""
    await apply_rls_context(db, str(current_user.id), current_user.role)


RLSContext = Annotated[None, Depends(with_rls)]
