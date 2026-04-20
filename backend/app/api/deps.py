"""API dependencies — auth + RBAC."""

import uuid
from typing import TYPE_CHECKING, Annotated, Any

from fastapi import Depends, HTTPException, Query, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit_context import audit_context_var
from app.core.security import (
    decode_access_token,
    decode_break_glass_token,
    decode_mfa_setup_token,
    decode_step_up_token,
)
from app.db.session import apply_rls_context, get_db
from app.models.enums import UserRole
from app.models.user import User
from app.services.budget_approval_service import BudgetApprovalService


class PaginationParams:
    """Reusable pagination dependency for list endpoints."""

    def __init__(
        self,
        skip: int = Query(0, ge=0),
        limit: int = Query(50, ge=1, le=200),
    ):
        self.skip = skip
        self.limit = limit


Pagination = Annotated[PaginationParams, Depends()]

if TYPE_CHECKING:
    from app.models.partner import PartnerProfile

# auto_error=False so we can fall back to cookies when no header is present
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


def _extract_token(
    bearer_token: str | None,
    request: Request,
) -> str | None:
    """Return a JWT from the Authorization header or the access-token cookie.

    The cookie name is the ``__Host-`` prefixed variant in HTTPS deployments;
    the legacy un-prefixed name is read as a fallback for rollout and for
    local plain-HTTP development where ``__Host-`` cannot be set.
    """
    if bearer_token:
        return bearer_token
    return request.cookies.get("__Host-access_token") or request.cookies.get("access_token")


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

    # Populate the user's role on the request-scoped audit context so that
    # subsequent transactions opened during this request pick it up via the
    # ``Session.after_begin`` listener in ``db/session.py``. Middleware cannot
    # do this itself because the JWT does not carry the role claim.
    ctx = audit_context_var.get()
    if ctx is not None and ctx.user_role is None:
        ctx.user_role = user.role

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
    token = (
        _extract_token(bearer_token, request)
        or request.cookies.get("__Host-mfa-setup-token")
        or request.cookies.get("mfa_setup_token")
    )

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
    """Belt-and-braces RLS context dependency.

    Most routes no longer need this: the ``Session.after_begin`` event
    listener in ``app/db/session.py`` reads the request's
    :data:`audit_context_var` and issues ``SET LOCAL`` at the start of every
    transaction automatically. ``get_current_user`` populates the role on
    the context so the listener has what it needs.

    This dep is kept for routes where the event-based path is insufficient
    — most commonly when a handler opens a *new* explicit transaction after
    ``get_current_user`` ran (so the original tx's ``SET LOCAL`` doesn't
    apply) and wants to guarantee the new tx has RLS vars before the first
    query. Declaring ``_rls: RLSContext`` forces the ``SET LOCAL`` early on
    the DB session FastAPI injected for the route.
    """
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


# ── Step-up auth (Phase 2.10 / 2.11) ────────────────────────
#
# ``require_step_up(action="view_pii")`` returns a dependency that accepts the
# request only when an ``X-Step-Up-Token`` header carries a valid step-up JWT
# whose subject matches the authenticated user *and* whose ``action_scope``
# includes ``action``.  Used to gate sensitive operations — PII reads, wire
# approvals, destructive admin actions, bulk export, MFA changes.


STEP_UP_HEADER = "X-Step-Up-Token"
BREAK_GLASS_HEADER = "X-Break-Glass-Token"


class StepUpRequired(HTTPException):
    """401 with a ``WWW-Authenticate`` hint per RFC 9470 semantics."""

    def __init__(self, action: str, message: str = "Step-up authentication required") -> None:
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "step_up_required", "action": action, "message": message},
            headers={
                "WWW-Authenticate": (
                    f'Bearer error="insufficient_user_authentication", '
                    f'error_description="{message}", action_scope="{action}"'
                )
            },
        )


def require_step_up(action: str) -> Any:
    """Dependency factory enforcing a valid step-up token for a named action."""

    async def _dep(request: Request, current_user: CurrentUser) -> User:
        token = request.headers.get(STEP_UP_HEADER)
        if not token:
            raise StepUpRequired(action, "Step-up token missing")
        payload = decode_step_up_token(token)
        if payload is None:
            raise StepUpRequired(action, "Step-up token invalid or expired")
        if payload.get("sub") != str(current_user.id):
            raise StepUpRequired(action, "Step-up token subject mismatch")
        scope = payload.get("action_scope") or []
        if action not in scope:
            raise StepUpRequired(action, "Step-up token does not cover this action")
        return current_user

    return _dep


def require_break_glass(action: str) -> Any:
    """Dependency factory accepting either step-up OR an active break-glass token."""

    async def _dep(request: Request, current_user: CurrentUser) -> User:
        # Break-glass takes precedence (stricter audit trail).
        bg = request.headers.get(BREAK_GLASS_HEADER)
        if bg:
            payload = decode_break_glass_token(bg)
            if payload and payload.get("sub") == str(current_user.id):
                scope = payload.get("action_scope") or []
                if action in scope:
                    return current_user
        # Fall back to step-up.
        su = request.headers.get(STEP_UP_HEADER)
        if su:
            payload = decode_step_up_token(su)
            if payload and payload.get("sub") == str(current_user.id):
                scope = payload.get("action_scope") or []
                if action in scope:
                    return current_user
        raise StepUpRequired(action, "Step-up or break-glass authorisation required")
