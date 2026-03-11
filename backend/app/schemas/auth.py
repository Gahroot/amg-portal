import re
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.models.enums import UserRole


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
        """Validate password meets complexity requirements."""
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")

        # Check for at least one uppercase letter
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")

        # Check for at least one lowercase letter
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter")

        # Check for at least one digit
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one digit")

        # Check for at least one special character
        if not re.search(r'[!@#$%^&*()_+\-=\[\]{};\'\\:"|<>,./?]', v):
            raise ValueError("Password must contain at least one special character")

        return v


class UserResponse(BaseModel):
    id: UUID
    email: str
    full_name: str
    phone_number: str | None = None
    role: UserRole
    status: str
    mfa_enabled: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    mfa_required: bool = False


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
        """Validate new password meets complexity requirements."""
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")

        # Check for at least one uppercase letter
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")

        # Check for at least one lowercase letter
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter")

        # Check for at least one digit
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one digit")

        # Check for at least one special character
        if not re.search(r'[!@#$%^&*()_+\-=\[\]{};\'\\:"|<>,./?]', v):
            raise ValueError("Password must contain at least one special character")

        return v


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
