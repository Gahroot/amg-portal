from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class RefreshTokenResponse(BaseModel):
    id: UUID
    user_id: UUID
    family_id: str
    is_revoked: bool
    expires_at: datetime
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
