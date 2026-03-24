from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, computed_field

# ---------------------------------------------------------------------------
# Duplicate detection schemas
# ---------------------------------------------------------------------------


class PartnerDuplicateCheckRequest(BaseModel):
    firm_name: str | None = None
    contact_name: str | None = None
    contact_email: EmailStr | None = None
    contact_phone: str | None = None
    exclude_id: UUID | None = None


class PartnerDuplicateMatchResponse(BaseModel):
    partner_id: UUID
    firm_name: str
    contact_name: str
    contact_email: str
    contact_phone: str | None
    similarity_score: float
    match_reasons: list[str]


class PartnerProfileCreate(BaseModel):
    firm_name: str
    contact_name: str
    contact_email: EmailStr
    contact_phone: str | None = None
    capabilities: list[str] = []
    geographies: list[str] = []
    notes: str | None = None


class PartnerProfileUpdate(BaseModel):
    firm_name: str | None = None
    contact_name: str | None = None
    contact_email: EmailStr | None = None
    contact_phone: str | None = None
    capabilities: list[str] | None = None
    geographies: list[str] | None = None
    availability_status: str | None = None
    max_concurrent_assignments: int | None = None
    compliance_verified: bool | None = None
    notes: str | None = None
    status: str | None = None


class PartnerProfileResponse(BaseModel):
    id: UUID
    user_id: UUID | None = None
    firm_name: str
    contact_name: str
    contact_email: str
    contact_phone: str | None = None
    capabilities: list[str] = []
    geographies: list[str] = []
    availability_status: str
    performance_rating: Decimal | None = None
    total_assignments: int
    completed_assignments: int
    max_concurrent_assignments: int = 5
    compliance_doc_url: str | None = None
    compliance_verified: bool
    notes: str | None = None
    status: str
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
    password: str | None = None
    send_welcome_email: bool = False


class CapabilityRefreshRequest(BaseModel):
    accreditations_confirmed: bool
    insurance_confirmed: bool
    capacity_confirmed: bool
    notes: str | None = None


class CapabilityRefreshStatusResponse(BaseModel):
    last_refreshed_at: datetime | None = None
    refresh_due_at: datetime | None = None
    is_overdue: bool
    is_due_soon: bool
    days_until_due: int | None = None


class RefreshDuePartnerResponse(BaseModel):
    id: UUID
    firm_name: str
    contact_name: str
    contact_email: str
    status: str
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
    block_reason: str | None = None
    utilisation: float
    status: str  # "available" | "partial" | "full" | "blocked"


class PartnerCapacityHeatmapResponse(BaseModel):
    partner_id: UUID
    start_date: date
    end_date: date
    days: dict[str, CapacityDayEntry]  # ISO date → CapacityDayEntry


class BlockedDateCreate(BaseModel):
    blocked_date: date
    reason: str | None = None


class BlockedDateResponse(BaseModel):
    id: UUID
    partner_id: UUID
    blocked_date: date
    reason: str | None = None
    created_by: UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PartnerCapacitySummaryEntry(BaseModel):
    """One partner's capacity on a target date — used in admin overview."""

    partner_id: str
    firm_name: str
    contact_name: str
    availability_status: str
    active_assignments: int
    max_concurrent: int
    is_blocked: bool
    utilisation: float
    status: str


class AllPartnersCapacitySummaryResponse(BaseModel):
    target_date: date
    partners: list[PartnerCapacitySummaryEntry]


# ── Partner Comparison schemas ────────────────────────────────────────────────


class PartnerComparisonItem(BaseModel):
    """Aggregated metrics for one partner in a side-by-side comparison."""

    partner_id: str
    firm_name: str
    contact_name: str
    availability_status: str
    status: str
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
    trend_direction: str  # "up" | "down" | "neutral"


class PartnerComparisonResponse(BaseModel):
    """Response for the partner comparison endpoint."""

    partners: list[PartnerComparisonItem]
