"""Schemas for client portal endpoints — excludes sensitive internal data."""

from datetime import date, datetime, time
from typing import Any
from uuid import UUID

from pydantic import BaseModel

# --- Portal Program Schemas (no budget, no internal notes) ---


class PortalMilestoneResponse(BaseModel):
    id: UUID
    title: str
    description: str | None = None
    due_date: date | None = None
    status: str
    position: int

    model_config = {"from_attributes": True}


class PortalProgramResponse(BaseModel):
    id: UUID
    title: str
    objectives: str | None = None
    scope: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    status: str
    rag_status: str = "green"
    milestone_count: int = 0
    completed_milestone_count: int = 0
    created_at: datetime


class PortalProgramListResponse(BaseModel):
    programs: list[PortalProgramResponse]
    total: int


class PortalProgramDetailResponse(BaseModel):
    id: UUID
    title: str
    objectives: str | None = None
    scope: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    status: str
    rag_status: str = "green"
    milestone_count: int = 0
    completed_milestone_count: int = 0
    milestones: list[PortalMilestoneResponse] = []
    deliverables: list["PortalDeliverableResponse"] = []
    created_at: datetime


class PortalDeliverableResponse(BaseModel):
    id: UUID
    title: str
    deliverable_type: str
    description: str | None = None
    due_date: date | None = None
    status: str
    submitted_at: datetime | None = None

    model_config = {"from_attributes": True}


# --- Portal Communication Schemas ---


class PortalCommunicationResponse(BaseModel):
    id: UUID
    channel: str
    subject: str | None = None
    body: str
    sent_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class PortalCommunicationListResponse(BaseModel):
    communications: list[PortalCommunicationResponse]
    total: int


# --- Portal Decision Schemas ---


class PortalDecisionOption(BaseModel):
    id: str
    label: str
    description: str | None = None


class PortalDecisionResponse(BaseModel):
    id: UUID
    program_id: UUID | None = None
    title: str
    prompt: str
    response_type: str
    options: list[dict[str, Any]] | None = None
    deadline_date: date | None = None
    deadline_time: time | None = None
    consequence_text: str | None = None
    status: str
    response: dict[str, Any] | None = None
    responded_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PortalDecisionListResponse(BaseModel):
    decisions: list[PortalDecisionResponse]
    total: int


class PortalDecisionRespondRequest(BaseModel):
    response: "PortalDecisionSubmitResponse"


class PortalDecisionSubmitResponse(BaseModel):
    option_id: str | None = None
    text: str | None = None


# --- Portal Profile Preferences ---


COMMUNICATION_PREFERENCES = {"in_portal", "email", "both"}


class PortalProfilePreferencesResponse(BaseModel):
    """Client-visible profile preferences."""

    communication_preference: str | None = None
    sensitivities: str | None = None
    special_instructions: str | None = None


class PortalProfilePreferencesUpdate(BaseModel):
    """Request body for updating profile preferences."""

    communication_preference: str | None = None
    sensitivities: str | None = None
    special_instructions: str | None = None


# --- Portal Intelligence File ---

# Keys the client is allowed to see and edit
CLIENT_VISIBLE_INTELLIGENCE_KEYS = {
    "objectives",
    "preferences",
    "lifestyle_profile",
    "travel_intel",
    "lifestyle_intel",
    "dietary_preferences",
}

# Keys only RMs can see (hidden from client portal)
RM_ONLY_INTELLIGENCE_KEYS = {
    "background",
    "family_intel",
    "relationship_insights",
    "internal_notes",
    "risk_notes",
    "compliance_intel",
}


class PortalIntelligenceResponse(BaseModel):
    """Client-safe subset of intelligence file data."""

    data: dict[str, Any]


class PortalIntelligenceUpdate(BaseModel):
    """Request body for client intelligence file updates."""

    data: dict[str, Any]
