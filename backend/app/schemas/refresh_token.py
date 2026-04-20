from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.schemas.base import Str100


class RefreshTokenResponse(BaseModel):
    id: UUID
    user_id: UUID
    family_id: Str100
    is_revoked: bool
    expires_at: datetime
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
