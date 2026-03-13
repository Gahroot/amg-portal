"""Tests for model enums — ensures enum values match expected domain constraints."""


from app.models.enums import (
    ALL_ROLES,
    INTERNAL_ROLES,
    ApprovalStatus,
    ClientType,
    EscalationLevel,
    EscalationStatus,
    NPSScoreCategory,
    ProgramStatus,
    SLABreachStatus,
    TaskPriority,
    TaskStatus,
    UserRole,
)


class TestUserRoles:
    def test_internal_roles_count(self) -> None:
        assert len(INTERNAL_ROLES) == 4

    def test_all_roles_count(self) -> None:
        assert len(ALL_ROLES) == 6

    def test_client_not_internal(self) -> None:
        assert UserRole.client not in INTERNAL_ROLES

    def test_partner_not_internal(self) -> None:
        assert UserRole.partner not in INTERNAL_ROLES

    def test_all_roles_include_internal(self) -> None:
        assert INTERNAL_ROLES.issubset(ALL_ROLES)


class TestProgramStatus:
    def test_has_intake_through_archived(self) -> None:
        values = {s.value for s in ProgramStatus}
        assert "intake" in values
        assert "active" in values
        assert "completed" in values
        assert "archived" in values


class TestTaskStatus:
    def test_terminal_states(self) -> None:
        assert TaskStatus.done.value == "done"
        assert TaskStatus.cancelled.value == "cancelled"


class TestTaskPriority:
    def test_priority_levels(self) -> None:
        priorities = [p.value for p in TaskPriority]
        assert priorities == ["low", "medium", "high", "urgent"]


class TestApprovalStatus:
    def test_has_full_workflow(self) -> None:
        values = {s.value for s in ApprovalStatus}
        assert "draft" in values
        assert "pending_compliance" in values
        assert "approved" in values
        assert "rejected" in values


class TestClientType:
    def test_has_all_client_types(self) -> None:
        values = {t.value for t in ClientType}
        assert "uhnw_individual" in values
        assert "family_office" in values
        assert "global_executive" in values


class TestSLABreachStatus:
    def test_three_states(self) -> None:
        assert len(SLABreachStatus) == 3

    def test_values(self) -> None:
        values = {s.value for s in SLABreachStatus}
        assert values == {"within_sla", "approaching_breach", "breached"}


class TestNPSScoreCategory:
    def test_categories(self) -> None:
        values = {c.value for c in NPSScoreCategory}
        assert values == {"detractor", "passive", "promoter"}


class TestEscalationFlow:
    def test_status_progression(self) -> None:
        statuses = [s.value for s in EscalationStatus]
        assert statuses.index("open") < statuses.index("resolved")
        assert statuses.index("resolved") < statuses.index("closed")

    def test_levels(self) -> None:
        levels = {level.value for level in EscalationLevel}
        assert "task" in levels
        assert "client_impact" in levels
