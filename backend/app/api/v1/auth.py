"""Auth endpoints."""

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.api.deps import DB, CurrentUser
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    hash_password,
    verify_password,
)
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    MFASetupResponse,
    MFAVerifyRequest,
    RefreshTokenRequest,
    Token,
    UserCreate,
    UserResponse,
)
from app.services.mfa_service import (
    generate_backup_codes,
    generate_provisioning_uri,
    generate_qr_code_base64,
    generate_totp_secret,
    verify_backup_code,
    verify_totp,
)

router = APIRouter()


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
async def register(data: UserCreate, db: DB):
    result = await db.execute(select(User).where(User.email == data.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    user = User(
        email=data.email,
        hashed_password=hash_password(data.password),
        full_name=data.full_name,
        role=UserRole.client.value,
        status="pending_approval",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/login", response_model=Token)
async def login(data: LoginRequest, db: DB):
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if user.status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is not active",
        )

    # MFA flow
    if user.mfa_enabled:
        if not data.mfa_code:
            return Token(
                access_token="",
                refresh_token="",
                mfa_required=True,
            )

        # Try TOTP first, then backup codes
        mfa_valid = False
        if user.mfa_secret and verify_totp(user.mfa_secret, data.mfa_code):
            mfa_valid = True
        elif user.mfa_backup_codes:
            valid, remaining = verify_backup_code(user.mfa_backup_codes, data.mfa_code)
            if valid:
                mfa_valid = True
                user.mfa_backup_codes = remaining
                await db.commit()

        if not mfa_valid:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid MFA code",
            )

    token_data = {"sub": str(user.id), "email": user.email}
    return Token(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
    )


@router.post("/refresh", response_model=Token)
async def refresh(data: RefreshTokenRequest, db: DB):
    payload = decode_refresh_token(data.refresh_token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user or user.status != "active":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )

    token_data = {"sub": str(user.id), "email": user.email}
    return Token(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: CurrentUser):
    return current_user


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    data: ChangePasswordRequest,
    current_user: CurrentUser,
    db: DB,
):
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    current_user.hashed_password = hash_password(data.new_password)
    await db.commit()


# ── MFA endpoints ──────────────────────────────────────────


@router.post("/mfa/setup", response_model=MFASetupResponse)
async def mfa_setup(current_user: CurrentUser, db: DB):
    """Generate MFA secret, QR code, and backup codes."""
    secret = generate_totp_secret()
    uri = generate_provisioning_uri(secret, current_user.email)
    qr_b64 = generate_qr_code_base64(uri)
    backup_codes = generate_backup_codes()

    # Store secret and backup codes but don't enable yet
    current_user.mfa_secret = secret
    current_user.mfa_backup_codes = backup_codes
    await db.commit()

    return MFASetupResponse(
        secret=secret,
        provisioning_uri=uri,
        qr_code_base64=qr_b64,
        backup_codes=backup_codes,
    )


@router.post("/mfa/verify-setup")
async def mfa_verify_setup(data: MFAVerifyRequest, current_user: CurrentUser, db: DB):
    """Verify a TOTP code to confirm MFA setup."""
    if not current_user.mfa_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MFA setup not initiated",
        )

    if not verify_totp(current_user.mfa_secret, data.code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code",
        )

    current_user.mfa_enabled = True
    await db.commit()
    return {"message": "MFA enabled successfully"}


@router.post("/mfa/disable")
async def mfa_disable(data: MFAVerifyRequest, current_user: CurrentUser, db: DB):
    """Disable MFA after verifying a TOTP code."""
    if not current_user.mfa_enabled or not current_user.mfa_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MFA is not enabled",
        )

    if not verify_totp(current_user.mfa_secret, data.code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code",
        )

    current_user.mfa_secret = None
    current_user.mfa_enabled = False
    current_user.mfa_backup_codes = None
    await db.commit()
    return {"message": "MFA disabled successfully"}
