"""Pydantic schemas for portal feedback API."""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.portal_feedback import FeedbackType

# ==================== Create/Update Schemas ====================


class PortalFeedbackCreate(BaseModel):
    """Schema for submitting new feedback."""

    feedback_type: str = Field(
        ..., min_length=1, max_length=50, description="Type of feedback"
    )
    description: str = Field(
        ..., min_length=10, max_length=10000, description="Feedback description"
    )
    page_url: str | None = Field(
        None, max_length=500, description="URL where feedback was submitted"
    )
    screenshot_url: str | None = Field(
        None, max_length=500, description="URL to attached screenshot"
    )
    email: str | None = Field(None, max_length=255, description="Email for follow-up")
    user_agent: str | None = Field(
        None, max_length=500, description="Browser user agent"
    )
    extra_data: dict[str, Any] | None = Field(None, description="Additional metadata")

    def validate_feedback_type(self) -> None:
        """Validate feedback type is one of the allowed values."""
        valid_types = {
            FeedbackType.BUG_REPORT,
            FeedbackType.FEATURE_REQUEST,
            FeedbackType.GENERAL_FEEDBACK,
            FeedbackType.QUESTION,
        }
        if self.feedback_type not in valid_types:
            raise ValueError(
                f"Invalid feedback type. Must be one of: {', '.join(valid_types)}"
            )


class PortalFeedbackUpdate(BaseModel):
    """Schema for updating feedback (admin only)."""

    status: str | None = Field(None, max_length=20)
    priority: str | None = Field(None, max_length=20)
    assigned_to: UUID | None = None
    resolution_notes: str | None = Field(None, max_length=10000)
    internal_notes: str | None = Field(None, max_length=10000)


# ==================== Response Schemas ====================


class PortalFeedbackResponse(BaseModel):
    """Schema for feedback response."""

    id: UUID
    user_id: UUID | None
    feedback_type: str
    description: str
    page_url: str | None
    screenshot_url: str | None
    email: str | None
    status: str
    priority: str | None
    assigned_to: UUID | None
    resolution_notes: str | None
    resolved_at: datetime | None
    resolved_by: UUID | None
    extra_data: dict[str, Any] | None
    created_at: datetime
    updated_at: datetime

    # Computed fields for display
    user_name: str | None = None
    user_email: str | None = None
    assignee_name: str | None = None

    model_config = ConfigDict(from_attributes=True)


class PortalFeedbackListResponse(BaseModel):
    """Schema for list of feedback items."""

    feedback: list[PortalFeedbackResponse]
    total: int


class PortalFeedbackSummary(BaseModel):
    """Schema for feedback summary statistics."""

    total: int
    by_status: dict[str, int]
    by_type: dict[str, int]
    by_priority: dict[str, int]
    unassigned_count: int
    open_count: int
    resolved_this_week: int


class PortalFeedbackTypeOption(BaseModel):
    """Schema for feedback type option."""

    value: str
    label: str
    description: str


class PortalFeedbackTypesResponse(BaseModel):
    """Schema for available feedback types."""

    types: list[PortalFeedbackTypeOption]


# ==================== Helper Functions ====================


def get_feedback_type_options() -> list[PortalFeedbackTypeOption]:
    """Get available feedback type options."""
    return [
        PortalFeedbackTypeOption(
            value=FeedbackType.BUG_REPORT,
            label="Bug Report",
            description="Report something that isn't working correctly",
        ),
        PortalFeedbackTypeOption(
            value=FeedbackType.FEATURE_REQUEST,
            label="Feature Request",
            description="Suggest a new feature or improvement",
        ),
        PortalFeedbackTypeOption(
            value=FeedbackType.GENERAL_FEEDBACK,
            label="General Feedback",
            description="Share your thoughts or suggestions",
        ),
        PortalFeedbackTypeOption(
            value=FeedbackType.QUESTION,
            label="Question",
            description="Ask a question about the portal",
        ),
    ]
