from datetime import datetime
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, ConfigDict, StringConstraints

# Reusable string constraints for schema-wide max_length enforcement.
# Pattern: tenable/pyTenable/tenable/io/sync/models/common.py.
# Keep caps >= underlying SQL column length so existing rows validate.
Str10 = Annotated[str, StringConstraints(max_length=10, strip_whitespace=True)]
Str50 = Annotated[str, StringConstraints(max_length=50, strip_whitespace=True)]
Str100 = Annotated[str, StringConstraints(max_length=100, strip_whitespace=True)]
Str255 = Annotated[str, StringConstraints(max_length=255, strip_whitespace=True)]
Str500 = Annotated[str, StringConstraints(max_length=500, strip_whitespace=True)]
Str2000 = Annotated[str, StringConstraints(max_length=2000, strip_whitespace=True)]
TextStr = Annotated[str, StringConstraints(max_length=10_000)]


class BaseResponse(BaseModel):
    """Base class for all ORM-backed response schemas."""

    id: UUID
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)
