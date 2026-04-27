import re
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models.enums import UserRole
from app.schemas.base import Str10, Str50, Str100, Str255, Str500, Str2000, TextStr

_RE_UPPER = re.compile(r"[A-Z]")
_RE_LOWER = re.compile(r"[a-z]")
_RE_DIGIT = re.compile(r"\d")
_RE_SPECIAL = re.compile(r'[!@#$%^&*()_+\-=\[\]{};\'\\:"|<>,./?]')


def _validate_password_strength(v: str) -> str:
    """Validate password meets complexity requirements."""
    if len(v) < 8:
        raise ValueError("Password must be at least 8 characters long")
    if not _RE_UPPER.search(v):
        raise ValueError("Password must contain at least one uppercase letter")
    if not _RE_LOWER.search(v):
        raise ValueError("Password must contain at least one lowercase letter")
    if not _RE_DIGIT.search(v):
        raise ValueError("Password must contain at least one digit")
    if not _RE_SPECIAL.search(v):
        raise ValueError("Password must contain at least one special character")
    return v


class LoginRequest(BaseModel):
    email: Str255
    password: Str255
    mfa_code: Str50 | None = None


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=255)
    full_name: Str255

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        return _validate_password_strength(v)


class UserResponse(BaseModel):
    id: UUID
    email: Str255
    full_name: Str255
    phone_number: Str50 | None = None
    role: UserRole
    status: Str50
    mfa_enabled: bool = False
    last_login_at: datetime | None = None
    created_at: datetime
    onboarding_completed: dict[str, bool] | None = None

    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    access_token: Str2000
    refresh_token: Str2000
    token_type: Str50 = "bearer"
    mfa_required: bool = False
    mfa_setup_required: bool = False
    mfa_setup_token: Str2000 | None = None


class MFASetupResponse(BaseModel):
    secret: Str255
    provisioning_uri: Str500
    qr_code_base64: TextStr
    backup_codes: list[Str50]


class MFAVerifyRequest(BaseModel):
    code: Str50


class RefreshTokenRequest(BaseModel):
    refresh_token: Str2000


class ChangePasswordRequest(BaseModel):
    current_password: Str255
    new_password: str = Field(min_length=8, max_length=255)

    @field_validator("new_password")
    @classmethod
    def validate_new_password_strength(cls, v: str) -> str:
        return _validate_password_strength(v)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: Str500
    new_password: str = Field(min_length=8, max_length=255)

    @field_validator("new_password")
    @classmethod
    def validate_new_password_strength(cls, v: str) -> str:
        return _validate_password_strength(v)


class ProfileUpdateRequest(BaseModel):
    """Request body for updating user profile."""

    full_name: Str255 | None = None
    phone_number: Str50 | None = None


class UserNotificationPreferencesResponse(BaseModel):
    """Response body for user notification preferences."""

    digest_enabled: bool
    digest_frequency: Str50
    notification_type_preferences: dict[str, str] | None = None
    channel_preferences: dict[str, bool] | None = None
    quiet_hours_enabled: bool
    quiet_hours_start: Str10 | None = None
    quiet_hours_end: Str10 | None = None
    timezone: Str100
    # Milestone reminder preferences
    milestone_reminder_days: list[int] | None = None
    milestone_reminder_channels: list[Str50] | None = None
    milestone_reminder_program_overrides: dict[str, object] | None = None


class UserNotificationPreferencesUpdate(BaseModel):
    """Request body for updating user notification preferences."""

    digest_enabled: bool | None = None
    digest_frequency: Str50 | None = None
    notification_type_preferences: dict[str, str] | None = None
    channel_preferences: dict[str, bool] | None = None
    quiet_hours_enabled: bool | None = None
    quiet_hours_start: Str10 | None = None
    quiet_hours_end: Str10 | None = None
    timezone: Str100 | None = None
    # Milestone reminder preferences
    milestone_reminder_days: list[int] | None = None
    milestone_reminder_channels: list[Str50] | None = None
    milestone_reminder_program_overrides: dict[str, object] | None = None


# Phase 2.10 — step-up auth token minting.
class StepUpTokenRequest(BaseModel):
    """Re-auth request to mint a step-up token.

    Provide at least one factor: password or TOTP code (if MFA enabled).
    ``action_scope`` is the list of action identifiers the token authorises.
    """

    password: Str255 | None = None
    totp_code: Str10 | None = None
    action_scope: list[Str50] = Field(default_factory=list, max_length=10)
