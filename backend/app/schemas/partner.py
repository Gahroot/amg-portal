from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, computed_field

from app.schemas.base import Str50, Str255, Str500, Str2000

# ---------------------------------------------------------------------------
# Duplicate detection schemas
# ---------------------------------------------------------------------------


class PartnerDuplicateCheckRequest(BaseModel):
    firm_name: Str255 | None = None
    contact_name: Str255 | None = None
    contact_email: EmailStr | None = None
    contact_phone: Str50 | None = None
    exclude_id: UUID | None = None


class PartnerDuplicateMatchResponse(BaseModel):
    partner_id: UUID
    firm_name: Str255
    contact_name: Str255
    contact_email: Str255
    contact_phone: Str50 | None
    similarity_score: float
    match_reasons: list[str]


class PartnerProfileCreate(BaseModel):
    firm_name: Str255
    contact_name: Str255
    contact_email: EmailStr
    contact_phone: Str50 | None = None
    capabilities: list[str] = []
    geographies: list[str] = []
    notes: Str2000 | None = None


class PartnerProfileUpdate(BaseModel):
    firm_name: Str255 | None = None
    contact_name: Str255 | None = None
    contact_email: EmailStr | None = None
    contact_phone: Str50 | None = None
    capabilities: list[str] | None = None
    geographies: list[str] | None = None
    availability_status: Str50 | None = None
    max_concurrent_assignments: int | None = None
    compliance_verified: bool | None = None
    notes: Str2000 | None = None
    status: Str50 | None = None


class PartnerProfileResponse(BaseModel):
    id: UUID
    user_id: UUID | None = None
    firm_name: Str255
    contact_name: Str255
    contact_email: Str255
    contact_phone: Str50 | None = None
    capabilities: list[str] = []
    geographies: list[str] = []
    availability_status: Str50
    performance_rating: Decimal | None = None
    total_assignments: int
    completed_assignments: int
    max_concurrent_assignments: int = 5
    compliance_doc_url: Str500 | None = None
    compliance_verified: bool
    notes: Str2000 | None = None
    status: Str50
    last_refreshed_at: datetime | None = None
    refresh_due_at: datetime | None = None
    created_by: UUID
    created_at: datetime
    updated_at: datetime

    @computed_field  # type: ignore[prop-decorator]
    @property
    def is_on_probation(self) -> bool:
        """Partner is on probation until they complete their first three engagements."""
        return int(self.completed_assignments) < 3

    model_config = ConfigDict(from_attributes=True)


class PartnerProfileListResponse(BaseModel):
    profiles: list[PartnerProfileResponse]
    total: int


class PartnerProvisionRequest(BaseModel):
    password: Str255 | None = None
    send_welcome_email: bool = False


class CapabilityRefreshRequest(BaseModel):
    accreditations_confirmed: bool
    insurance_confirmed: bool
    capacity_confirmed: bool
    notes: Str2000 | None = None


class CapabilityRefreshStatusResponse(BaseModel):
    last_refreshed_at: datetime | None = None
    refresh_due_at: datetime | None = None
    is_overdue: bool
    is_due_soon: bool
    days_until_due: int | None = None


class RefreshDuePartnerResponse(BaseModel):
    id: UUID
    firm_name: Str255
    contact_name: Str255
    contact_email: Str255
    status: Str50
    last_refreshed_at: datetime | None = None
    refresh_due_at: datetime | None = None
    is_overdue: bool
    days_until_due: int | None = None

    model_config = ConfigDict(from_attributes=True)


class RefreshDuePartnerListResponse(BaseModel):
    partners: list[RefreshDuePartnerResponse]
    total: int


# ── Capacity / Heatmap schemas ─────────────────────────────────────────────────


class CapacityDayEntry(BaseModel):
    """Capacity data for a single date."""

    active_assignments: int
    max_concurrent: int
    is_blocked: bool
    block_reason: Str500 | None = None
    utilisation: float
    status: Str50  # "available" | "partial" | "full" | "blocked"


class PartnerCapacityHeatmapResponse(BaseModel):
    partner_id: UUID
    start_date: date
    end_date: date
    days: dict[str, CapacityDayEntry]  # ISO date → CapacityDayEntry


class BlockedDateCreate(BaseModel):
    blocked_date: date
    reason: Str500 | None = None


class BlockedDateResponse(BaseModel):
    id: UUID
    partner_id: UUID
    blocked_date: date
    reason: Str500 | None = None
    created_by: UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PartnerCapacitySummaryEntry(BaseModel):
    """One partner's capacity on a target date — used in admin overview."""

    partner_id: Str50
    firm_name: Str255
    contact_name: Str255
    availability_status: Str50
    active_assignments: int
    max_concurrent: int
    is_blocked: bool
    utilisation: float
    status: Str50


class AllPartnersCapacitySummaryResponse(BaseModel):
    target_date: date
    partners: list[PartnerCapacitySummaryEntry]


# ── Partner Comparison schemas ────────────────────────────────────────────────


class PartnerComparisonItem(BaseModel):
    """Aggregated metrics for one partner in a side-by-side comparison."""

    partner_id: Str50
    firm_name: Str255
    contact_name: Str255
    availability_status: Str50
    status: Str50
    capabilities: list[str]
    geographies: list[str]
    compliance_verified: bool

    # Rating dimensions (1–5 scale, null = no data)
    avg_quality: float | None
    avg_timeliness: float | None
    avg_communication: float | None
    avg_overall: float | None
    total_ratings: int

    # SLA
    sla_compliance_rate: float | None  # 0–100 %
    total_sla_tracked: int
    total_sla_breached: int

    # Assignment history
    total_assignments: int
    completed_assignments: int
    active_assignments: int

    # Capacity
    max_concurrent_assignments: int
    capacity_utilisation: float  # 0–100 %
    remaining_capacity: int

    # Composite score & trend
    composite_score: float | None  # 0–100
    avg_recent_overall: float | None  # last 90 days avg overall rating
    trend_direction: Str50  # "up" | "down" | "neutral"


class PartnerComparisonResponse(BaseModel):
    """Response for the partner comparison endpoint."""

    partners: list[PartnerComparisonItem]
