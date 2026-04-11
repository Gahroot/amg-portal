import re
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models.enums import UserRole

# Password complexity rules — single source of truth.
#
# IMPORTANT: keep these rules in sync with the frontend Zod schema at
# `frontend/src/lib/validations/auth.ts`. The backend is canonical; if you
# change anything here, mirror it there (and update the tests on both sides).
PASSWORD_MIN_LENGTH = 8
# Character class listing every accepted special character.
# Note: `~` and backtick are intentionally NOT accepted.
PASSWORD_SPECIAL_PATTERN = r'[!@#$%^&*()_+\-=\[\]{};\'\\:"|<>,./?]'

_RE_UPPER = re.compile(r"[A-Z]")
_RE_LOWER = re.compile(r"[a-z]")
_RE_DIGIT = re.compile(r"\d")
_RE_SPECIAL = re.compile(PASSWORD_SPECIAL_PATTERN)


def _validate_password_strength(v: str) -> str:
    """Validate password meets complexity requirements."""
    if len(v) < PASSWORD_MIN_LENGTH:
        raise ValueError(
            f"Password must be at least {PASSWORD_MIN_LENGTH} characters long"
        )
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
    email: str
    password: str
    mfa_code: str | None = None


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        return _validate_password_strength(v)


class UserResponse(BaseModel):
    id: UUID
    email: str
    full_name: str
    phone_number: str | None = None
    role: UserRole
    status: str
    mfa_enabled: bool = False
    last_login_at: datetime | None = None
    created_at: datetime
    onboarding_completed: dict[str, bool] | None = None

    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    mfa_required: bool = False
    mfa_setup_required: bool = False
    mfa_setup_token: str | None = None


class MFASetupResponse(BaseModel):
    secret: str
    provisioning_uri: str
    qr_code_base64: str
    backup_codes: list[str]


class MFAVerifyRequest(BaseModel):
    code: str


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)

    @field_validator("new_password")
    @classmethod
    def validate_new_password_strength(cls, v: str) -> str:
        return _validate_password_strength(v)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8)

    @field_validator("new_password")
    @classmethod
    def validate_new_password_strength(cls, v: str) -> str:
        return _validate_password_strength(v)


class ProfileUpdateRequest(BaseModel):
    """Request body for updating user profile."""

    full_name: str | None = None
    phone_number: str | None = None


class UserNotificationPreferencesResponse(BaseModel):
    """Response body for user notification preferences."""

    digest_enabled: bool
    digest_frequency: str
    notification_type_preferences: dict[str, str] | None = None
    channel_preferences: dict[str, bool] | None = None
    quiet_hours_enabled: bool
    quiet_hours_start: str | None = None
    quiet_hours_end: str | None = None
    timezone: str
    # Milestone reminder preferences
    milestone_reminder_days: list[int] | None = None
    milestone_reminder_channels: list[str] | None = None
    milestone_reminder_program_overrides: dict[str, object] | None = None


class UserNotificationPreferencesUpdate(BaseModel):
    """Request body for updating user notification preferences."""

    digest_enabled: bool | None = None
    digest_frequency: str | None = None
    notification_type_preferences: dict[str, str] | None = None
    channel_preferences: dict[str, bool] | None = None
    quiet_hours_enabled: bool | None = None
    quiet_hours_start: str | None = None
    quiet_hours_end: str | None = None
    timezone: str | None = None
    # Milestone reminder preferences
    milestone_reminder_days: list[int] | None = None
    milestone_reminder_channels: list[str] | None = None
    milestone_reminder_program_overrides: dict[str, object] | None = None
