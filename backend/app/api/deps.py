"""API dependencies — auth + RBAC."""

import uuid
from typing import TYPE_CHECKING, Annotated

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_access_token, decode_mfa_setup_token
from app.db.session import apply_rls_context, get_db
from app.models.enums import UserRole
from app.models.user import User
from app.services.budget_approval_service import BudgetApprovalService

if TYPE_CHECKING:
    from app.models.partner import PartnerProfile

# auto_error=False so we can fall back to cookies when no header is present
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


def _extract_token(
    bearer_token: str | None,
    request: Request,
) -> str | None:
    """Return a JWT from the Authorization header or the access_token cookie."""
    if bearer_token:
        return bearer_token
    return request.cookies.get("access_token")


async def get_current_user(
    bearer_token: Annotated[str | None, Depends(oauth2_scheme)],
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    token = _extract_token(bearer_token, request)
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if token is None:
        raise credentials_exception

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


async def get_mfa_setup_user(
    bearer_token: Annotated[str | None, Depends(oauth2_scheme)],
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """Accept either a regular access token or an MFA setup token.

    Used exclusively on the MFA setup endpoints so that users who
    received an ``mfa_setup_token`` (no real access token yet) can
    still call /mfa/setup and /mfa/verify-setup.
    """
    token = _extract_token(bearer_token, request) or request.cookies.get("mfa_setup_token")

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if token is None:
        raise credentials_exception

    # Try regular access token first, then MFA setup token
    payload = decode_access_token(token) or decode_mfa_setup_token(token)
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


MFASetupUser = Annotated[User, Depends(get_mfa_setup_user)]


class RoleChecker:
    """Callable dependency that checks user role against allowed roles."""

    def __init__(self, allowed_roles: list[UserRole]):
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

require_client = RoleChecker([UserRole.client])


async def get_current_partner_profile(
    current_user: CurrentUser,
    db: DB,
) -> "PartnerProfile":
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


CurrentPartner = Annotated["PartnerProfile", Depends(get_current_partner_profile)]


async def with_rls(db: DB, current_user: CurrentUser) -> None:
    """Dependency that sets RLS context on the current DB session."""
    await apply_rls_context(db, str(current_user.id), current_user.role)


RLSContext = Annotated[None, Depends(with_rls)]


async def get_rm_client_ids(db: AsyncSession, rm_id: uuid.UUID) -> list[uuid.UUID]:
    """Get all client IDs (from the clients table) assigned to an RM.

    Used across multiple endpoints to scope data visibility for
    relationship_manager users to their own portfolio only.
    """
    from app.models.client import Client

    result = await db.execute(select(Client.id).where(Client.rm_id == rm_id))
    return list(result.scalars().all())


async def get_budget_approval_service(db: DB) -> BudgetApprovalService:
    """Provide a BudgetApprovalService bound to the current request's DB session."""
    return BudgetApprovalService(db)


BudgetApprovalServiceDep = Annotated[BudgetApprovalService, Depends(get_budget_approval_service)]
