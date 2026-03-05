from pydantic import BaseModel, EmailStr, Field

from app.models.enums import UserRole
from app.schemas.auth import UserResponse


class UserCreateByAdmin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str
    role: UserRole
    phone_number: str | None = None


class UserUpdate(BaseModel):
    full_name: str | None = None
    role: UserRole | None = None
    status: str | None = None
    phone_number: str | None = None


class UserListResponse(BaseModel):
    users: list[UserResponse]
    total: int
