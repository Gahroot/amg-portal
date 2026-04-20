from pydantic import BaseModel, EmailStr, Field

from app.models.enums import UserRole
from app.schemas.auth import UserResponse
from app.schemas.base import Str50, Str255


class UserCreateByAdmin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=255)
    full_name: Str255
    role: UserRole
    phone_number: Str50 | None = None


class UserUpdate(BaseModel):
    full_name: Str255 | None = None
    role: UserRole | None = None
    status: Str50 | None = None
    phone_number: Str50 | None = None


class UserListResponse(BaseModel):
    users: list[UserResponse]
    total: int


class ReportFavoritesResponse(BaseModel):
    favorites: list[str]
