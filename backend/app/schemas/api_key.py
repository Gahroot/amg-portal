"""Pydantic schemas for API Key management."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

# Available API key scopes
API_KEY_SCOPES = {
    "read:clients": "Read client information",
    "write:clients": "Create and update client information",
    "read:programs": "Read program information",
    "write:programs": "Create and update programs",
    "read:documents": "Read documents",
    "write:documents": "Upload and manage documents",
    "read:deliverables": "Read deliverables",
    "write:deliverables": "Submit and update deliverables",
    "read:partners": "Read partner information",
    "read:communications": "Read communications",
    "write:communications": "Send communications",
    "read:reports": "Generate and read reports",
    "admin:keys": "Manage API keys (create, update, revoke)",
    "*": "Full access to all resources",
}

# Default scopes for different roles
DEFAULT_SCOPES_BY_ROLE = {
    "client": ["read:programs", "read:documents", "write:documents", "read:communications"],
    "partner": ["read:deliverables", "write:deliverables", "read:communications"],
    "relationship_manager": [
        "read:clients",
        "write:clients",
        "read:programs",
        "write:programs",
        "read:documents",
        "write:documents",
        "read:deliverables",
        "write:deliverables",
        "read:communications",
        "write:communications",
        "read:reports",
    ],
    "coordinator": [
        "read:clients",
        "read:programs",
        "read:documents",
        "read:deliverables",
        "read:partners",
        "read:communications",
    ],
    "managing_director": ["*", "admin:keys"],
    "finance_compliance": [
        "read:clients",
        "read:programs",
        "read:documents",
        "read:deliverables",
        "read:partners",
        "read:reports",
    ],
}


class APIKeyCreate(BaseModel):
    """Request body for creating a new API key."""

    name: str = Field(
        min_length=1, max_length=100, description="A descriptive name for the API key"
    )
    scopes: list[str] = Field(min_length=1, description="List of permission scopes")
    expires_in_days: int | None = Field(
        default=None,
        ge=1,
        le=365,
        description="Number of days until expiration (null = no expiration)",
    )
    rate_limit: int | None = Field(
        default=None,
        ge=10,
        le=1000,
        description="Requests per minute (null = use default of 60)",
    )

    def get_expires_at(self) -> datetime | None:
        """Calculate the expiration datetime."""
        if self.expires_in_days is None:
            return None
        from datetime import UTC, timedelta

        return datetime.now(UTC) + timedelta(days=self.expires_in_days)


class APIKeyResponse(BaseModel):
    """Response for an API key (without the actual key)."""

    id: UUID
    name: str
    key_prefix: str
    scopes: list[str]
    is_active: bool
    last_used_at: datetime | None = None
    expires_at: datetime | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class APIKeyCreatedResponse(APIKeyResponse):
    """Response when an API key is first created (includes the actual key)."""

    key: str = Field(description="The API key (shown only once!)")
    warning: str = Field(
        default="This is the only time you will see this key. Store it securely!",
        description="Warning about key visibility",
    )


class APIKeyListResponse(BaseModel):
    """Response for listing API keys."""

    items: list[APIKeyResponse]
    total: int


class APIKeyUsageLog(BaseModel):
    """An entry in the API key usage log."""

    id: UUID
    api_key_id: UUID
    endpoint: str
    method: str
    status_code: int
    ip_address: str | None = None
    user_agent: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class APIKeyUsageResponse(BaseModel):
    """Response for API key usage logs."""

    items: list[APIKeyUsageLog]
    total: int
    api_key_id: UUID


class ScopeInfo(BaseModel):
    """Information about an available scope."""

    name: str
    description: str


class ScopesResponse(BaseModel):
    """Response for listing available scopes."""

    scopes: list[ScopeInfo]
