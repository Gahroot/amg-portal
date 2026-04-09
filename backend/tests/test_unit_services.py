"""Unit tests for core business logic — no database required.

These tests exercise pure functions and stateless logic that can be
validated without any infrastructure (no DB, no Redis, no HTTP).
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

# ---------------------------------------------------------------------------
# Security module
# ---------------------------------------------------------------------------


class TestPasswordHashing:
    """Tests for app.core.security.hash_password / verify_password."""

    def test_hash_password_returns_bcrypt_hash(self) -> None:
        from app.core.security import hash_password

        hashed = hash_password("Secret123!")
        assert hashed.startswith("$2")
        assert hashed != "Secret123!"

    def test_different_passwords_produce_different_hashes(self) -> None:
        from app.core.security import hash_password

        h1 = hash_password("passwordA")
        h2 = hash_password("passwordB")
        assert h1 != h2

    def test_same_password_produces_different_hashes_bcrypt_salt(self) -> None:
        from app.core.security import hash_password

        h1 = hash_password("samePassword")
        h2 = hash_password("samePassword")
        assert h1 != h2  # bcrypt uses random salt

    def test_verify_password_correct(self) -> None:
        from app.core.security import hash_password, verify_password

        hashed = hash_password("MyPass!")
        assert verify_password("MyPass!", hashed) is True

    def test_verify_password_wrong(self) -> None:
        from app.core.security import hash_password, verify_password

        hashed = hash_password("MyPass!")
        assert verify_password("WrongPass!", hashed) is False


class TestJWTTokens:
    """Tests for token creation and decoding."""

    def test_create_access_token_returns_string(self) -> None:
        from app.core.security import create_access_token

        token = create_access_token({"sub": "user-123", "email": "test@example.com"})
        assert isinstance(token, str)
        assert len(token) > 0

    def test_decode_access_token_valid(self) -> None:
        from app.core.security import create_access_token, decode_access_token

        token = create_access_token({"sub": "user-123", "email": "test@example.com"})
        payload = decode_access_token(token)
        assert payload is not None
        assert payload["sub"] == "user-123"
        assert payload["email"] == "test@example.com"
        assert payload["type"] == "access"
        assert "exp" in payload

    def test_decode_access_token_expired(self) -> None:
        import jwt as pyjwt

        from app.core.config import settings
        from app.core.security import decode_access_token

        # Create an already-expired token
        expired_token = pyjwt.encode(
            {
                "sub": "user-123",
                "email": "test@example.com",
                "exp": datetime.now(UTC) - timedelta(hours=1),
                "type": "access",
            },
            settings.SECRET_KEY,
            algorithm=settings.ALGORITHM,
        )
        assert decode_access_token(expired_token) is None

    def test_decode_access_token_wrong_type(self) -> None:
        import jwt as pyjwt

        from app.core.config import settings
        from app.core.security import decode_access_token

        # Create a token with wrong type (refresh instead of access)
        token = pyjwt.encode(
            {
                "sub": "user-123",
                "exp": datetime.now(UTC) + timedelta(hours=1),
                "type": "refresh",
            },
            settings.SECRET_KEY,
            algorithm=settings.ALGORITHM,
        )
        assert decode_access_token(token) is None

    def test_decode_access_token_invalid(self) -> None:
        from app.core.security import decode_access_token

        assert decode_access_token("not-a-real-token") is None
        assert decode_access_token("") is None

    def test_create_refresh_token_contains_jti_and_family(self) -> None:
        from app.core.security import create_refresh_token, decode_refresh_token

        token = create_refresh_token({"sub": "user-123", "email": "test@example.com"})
        payload = decode_refresh_token(token)
        assert payload is not None
        assert "jti" in payload
        assert "family" in payload
        assert payload["type"] == "refresh"

    def test_refresh_token_with_explicit_jti_and_family(self) -> None:
        from app.core.security import create_refresh_token, decode_refresh_token

        token = create_refresh_token(
            {"sub": "user-123", "email": "test@example.com"},
            family="family-abc",
            jti="jti-xyz",
        )
        payload = decode_refresh_token(token)
        assert payload is not None
        assert payload["jti"] == "jti-xyz"
        assert payload["family"] == "family-abc"

    def test_hash_token_produces_sha256_hex(self) -> None:
        from app.core.security import hash_token

        h = hash_token("some-token-value")
        assert isinstance(h, str)
        assert len(h) == 64  # SHA-256 hex digest

    def test_hash_token_deterministic(self) -> None:
        from app.core.security import hash_token

        assert hash_token("abc") == hash_token("abc")
        assert hash_token("abc") != hash_token("def")


class TestMFASetupToken:
    """Tests for MFA setup token flow."""

    def test_create_and_decode_mfa_setup_token(self) -> None:
        from app.core.security import create_mfa_setup_token, decode_mfa_setup_token

        token = create_mfa_setup_token({"sub": "user-123"})
        payload = decode_mfa_setup_token(token)
        assert payload is not None
        assert payload["sub"] == "user-123"
        assert payload["type"] == "mfa_setup"

    def test_mfa_setup_token_expired_fails(self) -> None:
        import jwt as pyjwt

        from app.core.config import settings
        from app.core.security import decode_mfa_setup_token

        expired = pyjwt.encode(
            {
                "sub": "user-123",
                "exp": datetime.now(UTC) - timedelta(minutes=1),
                "type": "mfa_setup",
            },
            settings.SECRET_KEY,
            algorithm=settings.ALGORITHM,
        )
        assert decode_mfa_setup_token(expired) is None

    def test_mfa_setup_token_wrong_type_fails(self) -> None:
        import jwt as pyjwt

        from app.core.config import settings
        from app.core.security import decode_mfa_setup_token

        token = pyjwt.encode(
            {
                "sub": "user-123",
                "exp": datetime.now(UTC) + timedelta(hours=1),
                "type": "access",
            },
            settings.SECRET_KEY,
            algorithm=settings.ALGORITHM,
        )
        assert decode_mfa_setup_token(token) is None


# ---------------------------------------------------------------------------
# Program state machine
# ---------------------------------------------------------------------------


class TestProgramStateMachine:
    """Tests for program status transition validation."""

    def test_valid_transitions_from_intake(self) -> None:
        from app.services.program_state_machine import validate_transition

        assert validate_transition("intake", "design") is True
        assert validate_transition("intake", "closed") is True
        assert validate_transition("intake", "active") is False
        assert validate_transition("intake", "completed") is False
        assert validate_transition("intake", "on_hold") is False

    def test_valid_transitions_from_design(self) -> None:
        from app.services.program_state_machine import validate_transition

        assert validate_transition("design", "active") is True
        assert validate_transition("design", "intake") is True
        assert validate_transition("design", "closed") is True
        assert validate_transition("design", "completed") is False

    def test_valid_transitions_from_active(self) -> None:
        from app.services.program_state_machine import validate_transition

        assert validate_transition("active", "on_hold") is True
        assert validate_transition("active", "completed") is True
        assert validate_transition("active", "closed") is True
        assert validate_transition("active", "intake") is False
        assert validate_transition("active", "design") is False

    def test_valid_transitions_from_on_hold(self) -> None:
        from app.services.program_state_machine import validate_transition

        assert validate_transition("on_hold", "active") is True
        assert validate_transition("on_hold", "closed") is True
        assert validate_transition("on_hold", "intake") is False

    def test_valid_transitions_from_completed(self) -> None:
        from app.services.program_state_machine import validate_transition

        assert validate_transition("completed", "closed") is True
        assert validate_transition("completed", "archived") is True
        assert validate_transition("completed", "active") is False

    def test_valid_transitions_from_closed(self) -> None:
        from app.services.program_state_machine import validate_transition

        assert validate_transition("closed", "archived") is True
        assert validate_transition("closed", "active") is False

    def test_archived_is_terminal(self) -> None:
        from app.services.program_state_machine import validate_transition

        assert validate_transition("archived", "intake") is False
        assert validate_transition("archived", "active") is False
        assert validate_transition("archived", "closed") is False

    def test_same_status_returns_false(self) -> None:
        from app.services.program_state_machine import validate_transition

        for status in ["intake", "design", "active", "on_hold", "completed", "closed", "archived"]:
            assert validate_transition(status, status) is False

    def test_unknown_status_returns_false(self) -> None:
        from app.services.program_state_machine import validate_transition

        assert validate_transition("unknown", "active") is False
        assert validate_transition("active", "unknown") is False


# ---------------------------------------------------------------------------
# Exception classes
# ---------------------------------------------------------------------------


class TestExceptions:
    """Tests for custom exception hierarchy."""

    def test_app_exception_defaults(self) -> None:
        from app.core.exceptions import AppException

        exc = AppException("test error")
        assert exc.message == "test error"
        assert exc.status_code == 500
        assert exc.details == {}

    def test_not_found_exception(self) -> None:
        from app.core.exceptions import NotFoundException

        exc = NotFoundException("User not found")
        assert exc.status_code == 404
        assert exc.message == "User not found"

    def test_bad_request_exception(self) -> None:
        from app.core.exceptions import BadRequestException

        exc = BadRequestException()
        assert exc.status_code == 400

    def test_unauthorized_exception(self) -> None:
        from app.core.exceptions import UnauthorizedException

        exc = UnauthorizedException("Invalid token")
        assert exc.status_code == 401

    def test_forbidden_exception(self) -> None:
        from app.core.exceptions import ForbiddenException

        exc = ForbiddenException()
        assert exc.status_code == 403

    def test_conflict_exception(self) -> None:
        from app.core.exceptions import ConflictException

        exc = ConflictException("Duplicate email")
        assert exc.status_code == 409
        assert exc.message == "Duplicate email"

    def test_validation_exception(self) -> None:
        from app.core.exceptions import ValidationException

        exc = ValidationException("Invalid transition")
        assert exc.status_code == 422

    def test_exception_with_details(self) -> None:
        from app.core.exceptions import AppException

        exc = AppException("error", details={"field": "email"})
        assert exc.details == {"field": "email"}

    def test_exception_inheritance(self) -> None:
        from app.core.exceptions import AppException, BadRequestException, NotFoundException

        assert issubclass(NotFoundException, AppException)
        assert issubclass(BadRequestException, AppException)

    def test_sanitize_error_message_removes_file_paths(self) -> None:
        from app.core.exceptions import _sanitize_error_message

        result = _sanitize_error_message("Error in /app/services/auth.py on line 42")
        assert "/app/services/auth.py" not in result
        assert "<file>" in result

    def test_sanitize_error_message_removes_sql(self) -> None:
        from app.core.exceptions import _sanitize_error_message

        # The regex replaces "SELECT ... FROM" with "<query>", so SELECT is consumed
        result = _sanitize_error_message("SELECT * FROM users WHERE id = 1")
        assert "SELECT" not in result or "<query>" in result

    def test_sanitize_error_message_removes_relation(self) -> None:
        from app.core.exceptions import _sanitize_error_message

        # regex: r'relation "[\w.]+"' → "relation"  (no more quoted name)
        result = _sanitize_error_message('relation "users" does not exist')
        assert 'relation "users"' not in result


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------


class TestEnums:
    """Tests for enum correctness and completeness."""

    def test_user_roles(self) -> None:
        from app.models.enums import UserRole

        assert UserRole.managing_director == "managing_director"
        assert UserRole.relationship_manager == "relationship_manager"
        assert UserRole.coordinator == "coordinator"
        assert UserRole.finance_compliance == "finance_compliance"
        assert UserRole.client == "client"
        assert UserRole.partner == "partner"

    def test_internal_roles(self) -> None:
        from app.models.enums import INTERNAL_ROLES, UserRole

        assert UserRole.managing_director in INTERNAL_ROLES
        assert UserRole.relationship_manager in INTERNAL_ROLES
        assert UserRole.coordinator in INTERNAL_ROLES
        assert UserRole.finance_compliance in INTERNAL_ROLES
        assert UserRole.client not in INTERNAL_ROLES
        assert UserRole.partner not in INTERNAL_ROLES

    def test_program_status_values(self) -> None:
        from app.models.enums import ProgramStatus

        statuses = {s.value for s in ProgramStatus}
        expected = {"intake", "design", "active", "on_hold", "completed", "closed", "archived"}
        assert statuses == expected

    def test_task_status_values(self) -> None:
        from app.models.enums import TaskStatus

        statuses = {s.value for s in TaskStatus}
        expected = {"todo", "in_progress", "blocked", "done", "cancelled"}
        assert statuses == expected

    def test_task_priority_values(self) -> None:
        from app.models.enums import TaskPriority

        priorities = {p.value for p in TaskPriority}
        expected = {"low", "medium", "high", "urgent"}
        assert priorities == expected

    def test_milestone_status_values(self) -> None:
        from app.models.enums import MilestoneStatus

        statuses = {s.value for s in MilestoneStatus}
        expected = {"pending", "in_progress", "at_risk", "completed", "cancelled"}
        assert statuses == expected

    def test_partner_status_values(self) -> None:
        from app.models.enums import PartnerStatus

        statuses = {s.value for s in PartnerStatus}
        expected = {"pending", "active", "suspended", "inactive"}
        assert statuses == expected

    def test_compliance_status_values(self) -> None:
        from app.models.enums import ComplianceStatus

        statuses = {s.value for s in ComplianceStatus}
        expected = {"pending_review", "under_review", "cleared", "flagged", "rejected"}
        assert statuses == expected

    def test_approval_status_values(self) -> None:
        from app.models.enums import ApprovalStatus

        statuses = {s.value for s in ApprovalStatus}
        expected = {
            "draft",
            "pending_compliance",
            "compliance_cleared",
            "pending_md_approval",
            "approved",
            "rejected",
        }
        assert statuses == expected

    def test_escalation_level_values(self) -> None:
        from app.models.enums import EscalationLevel

        levels = {level.value for level in EscalationLevel}
        expected = {"task", "milestone", "program", "client_impact"}
        assert levels == expected

    def test_communication_type_values(self) -> None:
        from app.models.enums import CommunicationType

        types = {t.value for t in CommunicationType}
        expected = {"email", "portal_message", "phone", "partner_submission", "client_inquiry"}
        assert types == expected

    def test_all_roles_is_superset(self) -> None:
        from app.models.enums import ALL_ROLES, INTERNAL_ROLES, UserRole

        assert INTERNAL_ROLES | {UserRole.client, UserRole.partner} == ALL_ROLES
